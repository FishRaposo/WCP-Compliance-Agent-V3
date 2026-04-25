"""Orchestrator script to run all seed scripts in sequence."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from seed_dbwd import seed as seed_dbwd
from seed_elasticsearch import seed as seed_elasticsearch
from seed_vectors import seed as seed_vectors


async def main() -> int:
    """Run all seed scripts in order.
    
    Order:
    1. DBWD rates → PostgreSQL
    2. Regulation chunks → Elasticsearch
    3. Embeddings → pgvector
    
    Returns:
        Total number of records seeded.
    """
    print("=" * 60)
    print("WCP Compliance Agent - Phase 2 Data Seeding")
    print("=" * 60)
    print()
    
    total = 0
    
    # 1. Seed DBWD rates
    print("[1/3] Seeding DBWD rates into PostgreSQL...")
    try:
        count = await seed_dbwd()
        total += count
        print(f"✓ Seeded {count} DBWD rate records")
    except Exception as e:
        print(f"✗ Failed to seed DBWD rates: {e}")
        return 1
    print()
    
    # 2. Seed Elasticsearch
    print("[2/3] Seeding regulation chunks into Elasticsearch...")
    try:
        count = await seed_elasticsearch()
        total += count
        print(f"✓ Indexed {count} regulation chunks")
    except Exception as e:
        print(f"✗ Failed to seed Elasticsearch: {e}")
        return 1
    print()
    
    # 3. Seed pgvector
    print("[3/3] Generating embeddings and storing in pgvector...")
    try:
        count = await seed_vectors()
        total += count
        print(f"✓ Stored {count} embeddings")
    except Exception as e:
        print(f"✗ Failed to seed pgvector: {e}")
        return 1
    print()
    
    print("=" * 60)
    print(f"Seeding complete! Total: {total} records")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
