# Bob — Coaching Corrections

## #1: File existence check
Before editing a file, verify it exists. If the task describes a file ambiguously, `ls` the directory and confirm the match. If no file matches, report the error and move on — do NOT edit a similarly-named file.

## #2: Post-sed verification
After running sed, grep for the expected NEW text. If grep finds nothing, the sed failed silently. Diagnose why (escaping? backticks? wrong pattern?) before retrying.

## #3: Diagnose before retry
If sed produces no output and the file is unchanged, do NOT try variations blindly. Read the target line with `cat -n` to see exact characters, then fix your sed pattern to match.
