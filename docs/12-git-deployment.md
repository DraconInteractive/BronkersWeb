# One-command Git deployment on the VPS

This workflow builds from a Git checkout on the VPS, then copies the finished
static game into a new release directory and atomically changes the `current`
symlink. Caddy continues serving `/var/www/bronkers/current/public` on its existing
internal port 43187. No Caddy configuration change or reload is needed per update.
Node is used for builds only; there is no additional long-running app service.

## 1. Publish the implementation to GitHub

The implementation and scripts must be committed and pushed before a VPS clone
can contain them. On the development machine, from the repository directory,
review `git status` and the files to be published, then:

```sh
git add .
git commit -m "Implement Bronkers game and Git deployment pipeline"
git push origin main
```

`.tools/`, `node_modules/`, build output, browser reports and release archives are
ignored. Future iterations follow the usual edit → test → commit → push workflow.
The deploy script never discards or stashes checkout changes.

## 2. One-time VPS setup

For the existing Ubuntu VPS, install the small command-line prerequisites if
missing, then clone as your regular deploy user (`pmc` in the current setup):

```sh
sudo apt-get update
sudo apt-get install git curl xz-utils util-linux
git clone https://github.com/DraconInteractive/BronkersWeb.git ~/BronkersWeb
cd ~/BronkersWeb
sudo ./scripts/deploy init --user "$(id -un)"
```

If a checkout already exists, use that checkout and update it to the branch
containing these scripts instead of cloning another copy.

`init` prepares `/var/www/bronkers` and its `releases/` directory for the deploy
user. If `current/` is the real directory created by extracting the archive, it
moves that directory into `releases/legacy-...` and replaces `current` with a
symlink. The old site is retained for rollback. This first migration involves a
brief directory rename/link transition; subsequent activations replace the
symlink atomically. Running init again does not migrate an existing valid symlink.

Only this setup command normally needs sudo. Run all builds and updates as the
regular user, so npm and downloaded build tools do not run as root. Caddy can read
the copied public files without access to the source checkout in your home folder.

## 3. Deploy, including the first Git release

```sh
cd ~/BronkersWeb
./scripts/deploy
```

The command:

1. Acquires locks so overlapping deployments/builds cannot interfere.
2. Requires a clean checkout on a branch with a configured upstream.
3. Runs `git pull --ff-only` and verifies HEAD matches the upstream commit.
4. Installs or checks the pinned Node version inside `.tools/node`.
5. Runs `npm ci --include=dev` using the committed lockfile and local cache.
6. Runs the engine tests, then type checking and the production build.
7. Creates a release with public files and a manifest recording its Git commit.
8. Retains old hashed assets so a page loading during the switch can finish.
9. Records the old release as `previous` and atomically activates the new one.

A pull, install, test, or build failure stops deployment before the live symlink
changes. After a failed build the checkout may contain the newly pulled commit,
but the served site still points to the previous successful release. Push a fix
and run the command again. Refresh the browser to load the new game version.

Browser testing remains on the development machine. The VPS pipeline does not
install Playwright browsers or their OS libraries.

The Node installer supports Linux x86-64 and ARM64. If a future commit changes
`.node-version` while an older local runtime is installed, deployment stops with
an explicit mismatch message and leaves the live release alone. Move the old
`.tools/node` directory aside and rerun `./scripts/setup-node` to install the new
pin before deploying again.

For a deliberate build of the already checked-out clean commit without fetching:

```sh
./scripts/deploy --no-pull
```

## 4. Status and rollback

```sh
./scripts/deploy status
./scripts/deploy rollback
```

Rollback switches to `previous`, without pulling, installing dependencies, or
building. It also records the replaced release as `previous`, so running it again
switches back. To choose a specific retained release listed by `status`:

```sh
./scripts/deploy rollback RELEASE_ID
```

Old releases and compatibility assets are retained rather than automatically
removed. Disk usage grows with the number of deployments. Prune old releases
only after checking that they are not `current` or `previous` and are no longer
needed for rollback. The script does not touch other services or web roots.

## Optional: invoke deployment from your development machine

Once your SSH access is configured, the same pipeline can be triggered remotely:

```sh
ssh pmc@YOUR_VPS 'cd ~/BronkersWeb && ./scripts/deploy'
```

This is still an explicit deployment command, not an automatic deployment on
every push. No SSH keys, repository tokens, or server credentials are stored in
the project.

## Development checks for the deployment script

```sh
python3 tests/deployment/check.py
```

This uses temporary directories and a temporary local Git remote. It runs real
npm installs, engine tests and production builds, and checks the initial archive
migration, successful updates, dirty/ahead checkout refusal, failed-build safety,
locks and rollback. It does not connect to or modify the actual VPS.

For a different static hosting root, add `--root /absolute/app/path` to init,
update, status and rollback consistently.
