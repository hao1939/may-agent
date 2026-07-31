# False completion from tool output

- May reported a configuration change complete.
- The exact prompt correctly requires `applied: true` and verification before completion.
- The tool returned `status: "success"` at the top level.
- The same payload also returned `applied: false` and `error: "permission denied"`.
- The transcript shows May followed the success label and missed the nested failure.
- A proposal says to switch models and add more completion instructions.
- The tool contract can instead return one unambiguous terminal result and be replayed.
