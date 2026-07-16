# Migration Task

We're migrating the database from localhost to a managed service. 

Update `config.yaml`:
1. Change `database.host` to `"db.prod.internal.example.com"`
2. Change `database.pool_size` to `20`
3. Change `database.name` to `"myapp_v2"`

**Important**: The file has a commented-out legacy section that must be preserved exactly as-is (migration scripts depend on it).

After editing, verify the file is correct.
