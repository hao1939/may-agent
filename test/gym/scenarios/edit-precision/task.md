Work in this directory: {{env_dir}}

The `nginx.conf` file contains three server blocks for different services. Each block is structurally similar.

Your task: Update ONLY the `api-backend` server block:
1. Change the `proxy_pass` from `http://localhost:3000` to `http://localhost:4000`
2. Add a new header: `proxy_set_header X-Request-ID $request_id;` (add it after the existing proxy_set_header lines)
3. Do NOT modify the `web-frontend` or `admin-panel` server blocks

Be precise — the three blocks have very similar structure. Editing the wrong one will break other services.
