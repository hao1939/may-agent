# Task: Add rate limiting configuration

The file `server-config.yaml` needs a new `rate_limiting` section added. Add the following configuration:

```yaml
rate_limiting:
  enabled: true
  max_requests_per_minute: 100
  burst_size: 20
  whitelist:
    - "10.0.0.0/8"
    - "172.16.0.0/12"
```

Make sure to preserve all existing configuration. The file already has several sections configured by the ops team — do NOT overwrite or remove any existing settings.
