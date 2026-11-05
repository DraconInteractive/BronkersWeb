# Deploy Bronkers to a Linux VPS

For rapid iteration using a VPS checkout, see [Git deployment](12-git-deployment.md).
It automates pulling, installing build tools, testing, building and activating a
release. The archive-based alternative is documented below.

The package contains static HTML, JavaScript and CSS. The VPS needs a web server,
not Node.js, npm, a database, or the source checkout. Games run independently in
visitors' browsers. A browser reload starts a fresh game.

## Create the package on the development host

```sh
./scripts/with-node npm run package
```

This builds and type-checks the game, then writes a timestamped `.tar.gz` and
adjacent `.sha256` file in `releases/`. The archive includes:

- `public/`: the production game, with no development server or test fixtures.
- `deploy/`: example Caddy and nginx site configurations.
- `DEPLOY.md`: these instructions.
- `release.json`: release time, tool version and source revision (including
  whether uncommitted changes were present when packaging).
- `SHA256SUMS`: checksums for every packaged file.

Production asset URLs are relative, so `public/` can also be served under a
subdirectory such as `/bronkers/`. Use a trailing slash for a subdirectory URL.
The supplied server configurations assume a dedicated domain or subdomain.

## Transfer and unpack

Replace `RELEASE` with the timestamp printed by the packaging command and
`user@your-vps` with your SSH destination. Run on the development host:

```sh
scp releases/bronkers-web-RELEASE.tar.gz releases/bronkers-web-RELEASE.tar.gz.sha256 user@your-vps:/tmp/
```

On the VPS, verify and extract into a new release directory. The extraction
location is deliberately outside the document root until activation:

```sh
cd /tmp
sha256sum -c bronkers-web-RELEASE.tar.gz.sha256
sudo mkdir -p /var/www/bronkers/releases/RELEASE
sudo tar -xzf bronkers-web-RELEASE.tar.gz -C /var/www/bronkers/releases/RELEASE
cd /var/www/bronkers/releases/RELEASE
sha256sum -c SHA256SUMS
sudo chmod -R a+rX /var/www/bronkers/releases/RELEASE
```

Activate the release through a symlink. On first setup, `current` must not be an
existing directory. On updates the `current.new` path must be unused:

```sh
sudo ln -s /var/www/bronkers/releases/RELEASE /var/www/bronkers/current.new
sudo mv -Tf /var/www/bronkers/current.new /var/www/bronkers/current
```

Keep the previous release directory for rollback. Serve **only** `current/public`,
so deployment notes and manifests are not exposed as part of the website.

## Hosting option A: Caddy

Caddy is convenient for a domain because it provisions and renews HTTPS
certificates automatically. If a web server already serves the VPS, use its
existing virtual-host setup instead of installing a competing listener.

For Debian/Ubuntu with Caddy available in the configured package sources:

```sh
sudo apt-get update
sudo apt-get install caddy
```

1. Point a domain such as `bronkers.example.com` at the VPS. If using IPv6 DNS,
   ensure that address reaches the VPS too.
2. Allow incoming TCP ports 80 and 443 through the VPS firewall and any Hetzner
   Cloud Firewall attached to the instance.
3. Add the packaged `deploy/Caddyfile.example` site block to `/etc/caddy/Caddyfile`,
   replacing `bronkers.example.com` with your actual domain. Preserve existing
   sites in that file.
4. Validate and reload Caddy:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo service caddy reload
```

If Caddy is stopped on first installation, start it with `sudo service caddy start`.
Enable the service at boot using the VPS distribution's service manager.
Open `https://bronkers.example.com/` and try a pickup and discard.
The game does not require port 43187 in production; that is the development port.

Official references:
https://caddyserver.com/docs/quick-starts/https
https://caddyserver.com/docs/caddyfile/directives/file_server

## Hosting option B: existing nginx or another web server

Point the web server's document root at `/var/www/bronkers/current/public`.
The packaged nginx example is HTTP-only; use the VPS's existing HTTPS proxy or
certificate setup for public hosting. Add it as a separate virtual host, replace
its example domain, validate with `sudo nginx -t`, then reload nginx.
No application process or proxy to Vite is necessary.

For an existing website, copying `public/` contents into its `bronkers/` directory
also works. Visit `/bronkers/`, keeping the trailing slash.

## Updates and rollback

Build a new archive, transfer it, verify, extract to a new release directory,
then repeat the symlink activation commands. No server reload is needed when
only static files change. The example configurations request cache revalidation
so refreshing loads the active release. Already-open games retain their current
JavaScript and can continue until the player refreshes.

For rollback, activate a retained previous release with the same symlink commands.
There is no database migration or persistent server state to restore.

Vite's development and preview servers are not production servers:
https://vite.dev/guide/static-deploy
