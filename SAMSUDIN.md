# SAMSUDIN Developer & Project Instructions

This file contains persistent operational rules and architecture guidelines injected into the Samsudin agent loop.

## Core Directives
1. **Perceive Before Acting**: Always inspect existing files using `view_file` or `grep` before making modifications.
2. **Targeted Precision**: Use `replace_file_content` with exact whitespace and unique blocks rather than rewriting whole files.
3. **Automated Verification**: Run test suites or syntax checks with `bash` before declaring a task complete.
4. **Resilience**: If a test or command returns an error code, inspect the stderr, refine your solution, and verify again.
5. **No Hallucinated Tools**: Only use the tools defined in the system prompt (`bash`, `view_file`, `write_file`, `replace_file_content`, `grep`, `glob`).
