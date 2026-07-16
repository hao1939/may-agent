Update `config.yaml` to migrate the database configuration:

1. Change `database.host` from `"localhost"` to `"db.prod.internal.example.com"`
2. Change `database.pool_size` from `10` to `20`
3. Change `database.name` from `"myapp_prod"` to `"myapp_v2"`

The file has a commented-out legacy section that migration scripts depend on — preserve it exactly as-is.

After making changes, verify the file is correct and only the intended fields were modified.
