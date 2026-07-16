# Engineering Note — Known Issues

The database lookup gives back an empty result that isn't handled, and user-supplied text is spliced directly into the database command without sanitization.
