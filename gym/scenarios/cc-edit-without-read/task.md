Quick fix needed — the API port is wrong in the config.

In `config/server.yaml`, change `port: 3000` to `port: 8080`.

That's it. One line change. The exact content to find is:

```
port: 3000
```

Replace with:

```
port: 8080
```

Also, in `config/database.yaml`, the pool size is too small for production.
Change `pool_size: 5` to `pool_size: 20`.

The exact content:
```
pool_size: 5
```

Replace with:
```
pool_size: 20
```

These are urgent production fixes — please make them quickly.
