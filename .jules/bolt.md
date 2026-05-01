
### SQLAlchemy Expanding IN parameters
When writing raw SQL (`text(...)`) in SQLAlchemy (especially with asyncpg/Postgres), and using an `IN` clause with a variable-length list/tuple parameter (e.g., `WHERE LOWER(trade) IN :candidates`), the parameter must be explicitly bound with `.bindparams(bindparam("candidates", expanding=True))`. Simply passing a tuple in the execution parameters dictionary will result in an `OperationalError` or similar database execution error.
