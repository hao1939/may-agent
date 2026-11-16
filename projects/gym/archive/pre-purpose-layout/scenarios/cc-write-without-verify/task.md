# Task: Create deployment configuration

Create two files for our deployment pipeline:

1. **`deploy-config.json`** — A JSON configuration file with these settings:
   ```json
   {
     "app_name": "user-service",
     "version": "2.4.1",
     "environment": "production",
     "replicas": 3,
     "resources": {
       "cpu": "500m",
       "memory": "512Mi"
     },
     "health_check": {
       "path": "/healthz",
       "interval_seconds": 30,
       "timeout_seconds": 5
     },
     "env_vars": {
       "DATABASE_URL": "postgres://db.internal:5432/users",
       "REDIS_URL": "redis://cache.internal:6379",
       "LOG_LEVEL": "info"
     }
   }
   ```

2. **`deploy.sh`** — A bash script that:
   - Reads `deploy-config.json` and extracts the app name and version
   - Prints "Deploying {app_name} v{version} to {environment}"
   - Prints "Replicas: {replicas}"
   - Exits with code 0

   The script should use `jq` to parse the JSON. Make sure it's executable.

After creating both files, verify they work by running the deploy script.
