#!/usr/bin/env python3
"""Exercise the real deployment pipeline against a temporary local Git remote."""
import fcntl
import getpass
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

PROJECT = Path(__file__).resolve().parents[2]


def run(args, cwd, success=True):
    result = subprocess.run([str(arg) for arg in args], cwd=cwd, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if (result.returncode == 0) != success:
        raise AssertionError(f"Unexpected result: {args}\n{result.stdout}")
    return result.stdout


def commit(repo, message):
    run(['git', 'add', '.'], repo)
    run(['git', 'commit', '-m', message], repo)
    return run(['git', 'rev-parse', 'HEAD'], repo).strip()


def check():
    with tempfile.TemporaryDirectory(prefix='bronkers-deploy-') as temporary:
        base = Path(temporary)
        source = base / 'source'
        source.mkdir()
        for name in ['src', 'server', 'scripts', 'tests', 'docs', 'deploy', 'reports']:
            shutil.copytree(PROJECT / name, source / name)
        for name in ['.gitignore', '.gitattributes', '.node-version', 'package.json',
                     'package-lock.json', 'index.html', 'tsconfig.json',
                     'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'README.md']:
            shutil.copy2(PROJECT / name, source / name)
        run(['git', 'init', '--initial-branch=main'], source)
        for key, value in [('user.name', 'Deploy test'), ('user.email', 'deploy@example.invalid')]:
            run(['git', 'config', key, value], source)
        first_commit = commit(source, 'Initial fixture')
        remote = base / 'remote.git'
        run(['git', 'clone', '--bare', source, remote], base)
        run(['git', 'remote', 'add', 'origin', remote], source)
        checkout = base / 'checkout'
        run(['git', 'clone', remote, checkout], base)
        for key, value in [('user.name', 'Deploy test'), ('user.email', 'deploy@example.invalid')]:
            run(['git', 'config', key, value], checkout)
        tools = checkout / '.tools'
        tools.mkdir()
        # Reuse downloads, but let npm ci create an independent node_modules.
        (tools / 'node').symlink_to(PROJECT / '.tools/node', target_is_directory=True)
        (tools / 'npm-cache').symlink_to(PROJECT / '.tools/npm-cache', target_is_directory=True)
        root = base / 'www'
        public = root / 'current/public'
        (public / 'assets').mkdir(parents=True)
        (public / 'index.html').write_text('Legacy site')
        (public / 'assets/legacy.js').write_text('/* old asset */')

        def deploy(*args, success=True):
            return run(['./scripts/deploy', *args, '--root', root], checkout, success)

        def active():
            return (root / 'current').resolve()

        deploy('init', '--user', getpass.getuser())
        legacy = active()
        assert (root / 'current').is_symlink()
        assert (legacy / 'public/index.html').read_text() == 'Legacy site'
        assert (root / 'releases').stat().st_uid == os.getuid()
        print('PASS: extracted-directory migration preserves the existing site', flush=True)

        deploy()
        first = active()
        assert first != legacy
        assert json.loads((first / 'release.json').read_text())['sourceCommit'] == first_commit
        assert (first / 'public/assets/legacy.js').is_file()
        assert (root / 'previous').resolve() == legacy
        assert (root / 'runtime/node').is_file()
        assert (root / 'telemetry').resolve() == first / 'server'
        assert (first / 'server/contract.ts').is_file()
        print('PASS: git pull, real npm ci, engine tests, production build and activation', flush=True)

        entry = checkout / 'src/main.ts'
        original = entry.read_text()
        entry.write_text(original + '\n// local edit\n')
        assert 'local changes' in deploy(success=False)
        assert active() == first
        entry.write_text(original)
        print('PASS: dirty checkout is rejected without changing the live release', flush=True)

        html = source / 'index.html'
        html.write_text(html.read_text().replace('<title>Bronkers</title>', '<title>Bronkers update</title>'))
        second_commit = commit(source, 'Update title')
        run(['git', 'push', 'origin', 'main'], source)
        deploy()
        second = active()
        assert second != first
        assert '<title>Bronkers update</title>' in (second / 'public/index.html').read_text()
        assert json.loads((second / 'release.json').read_text())['sourceCommit'] == second_commit
        assert (root / 'previous').resolve() == first
        assert all((second / 'public/assets' / asset.name).exists() for asset in (first / 'public/assets').iterdir())
        print('PASS: a pushed commit deploys and retains previous hashed assets', flush=True)

        main = source / 'src/main.ts'
        good = main.read_text()
        main.write_text(good + "\nconst broken: number = 'bad type';\n")
        commit(source, 'Broken build')
        run(['git', 'push', 'origin', 'main'], source)
        deploy(success=False)
        assert active() == second
        assert (root / 'previous').resolve() == first
        assert not list((root / 'releases').glob('.build.*'))
        print('PASS: a failed build leaves current and previous releases untouched', flush=True)

        main.write_text(good)
        commit(source, 'Fix build')
        run(['git', 'push', 'origin', 'main'], source)
        deploy()
        recovered = active()
        assert recovered != second
        assert (root / 'previous').resolve() == second
        print('PASS: deployment recovers on the next good commit', flush=True)

        telemetry = (root / 'telemetry').resolve()
        (root / 'telemetry').unlink()
        (root / 'telemetry').mkdir()
        assert 'telemetry must be a symlink' in deploy('rollback', success=False)
        assert active() == recovered
        (root / 'telemetry').rmdir()
        (root / 'telemetry').symlink_to(telemetry, target_is_directory=True)
        print('PASS: an invalid API link refuses activation without changing the live release', flush=True)

        with (root / '.deploy.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            assert 'Another deployment' in deploy('rollback', success=False)
        assert active() == recovered
        deploy('rollback')
        assert active() == second
        assert (root / 'previous').resolve() == recovered
        deploy('rollback', legacy.name)
        assert active() == legacy
        assert (root / 'telemetry').resolve() == second / 'server'
        deploy('rollback')
        assert active() == second
        deploy('rollback', '../escape', success=False)
        assert active() == second
        print('PASS: deployment lock, rollback, named rollback and release validation', flush=True)

        readme = checkout / 'README.md'
        readme.write_text(readme.read_text() + '\nLocal committed edit\n')
        commit(checkout, 'Unpublished local commit')
        assert 'unpublished commits' in deploy(success=False)
        assert active() == second
        assert second.name in deploy('status')
        print('PASS: unpublished commits are rejected and status reports retained releases', flush=True)


if __name__ == '__main__':
    check()
