"""Index DBWD regulation chunks into Elasticsearch for BM25 retrieval."""

from __future__ import annotations

import asyncio
from pathlib import Path

from elasticsearch import AsyncElasticsearch

from wcp_backend.config import settings


INDEX_NAME = "regulation_chunks"
CORPUS_PATH = Path(__file__).parent.parent / "src/wcp_backend/data/dbwd_corpus.json"

# Sample regulation text for each trade
REGULATION_TEXTS = {
    "Electrician": "40 U.S.C. Section 3141-3148 (Davis-Bacon Act) requires payment of prevailing wages to laborers and mechanics on federal contracts. Electricians must be paid not less than the prevailing wage rate for electricians in the locality. Overtime pay at 1.5 times the basic hourly rate is required for hours worked over 40 in a workweek.",
    "Plumber": "40 U.S.C. Section 3141-3148 (Davis-Bacon Act) requires payment of prevailing wages. Plumbers must receive not less than the prevailing wage rate for plumbers in the locality, plus fringe benefits. The Contract Work Hours and Safety Standards Act requires overtime pay at 1.5 times the basic hourly rate for hours over 40.",
    "Carpenter": "40 U.S.C. Section 3141-3148 (Davis-Bacon Act) mandates prevailing wages for carpenters. Carpenters on federal projects must be paid the prevailing wage rate for their locality. Apprentices may be paid less if registered in approved apprenticeship programs.",
    "Laborer": "40 U.S.C. Section 3141-3148 (Davis-Bacon Act) requires prevailing wages for laborers. Common laborers must receive not less than the prevailing wage rate plus fringe benefits. All workers must be paid weekly and receive certified payroll records.",
    "Equipment Operator": "40 U.S.C. Section 3141-3148 (Davis-Bacon Act) requires prevailing wages for equipment operators. Heavy equipment operators must receive the prevailing wage rate for their classification. Different equipment types may have different wage rates.",
}


async def create_index(es: AsyncElasticsearch) -> None:
    """Create the regulation_chunks index if it doesn't exist."""
    exists = await es.indices.exists(index=INDEX_NAME)
    if exists:
        print(f"Index {INDEX_NAME} already exists")
        return
    
    await es.indices.create(
        index=INDEX_NAME,
        body={
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": {
                    "analyzer": {
                        "default": {
                            "type": "standard"
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "chunk_id": {"type": "keyword"},
                    "text": {"type": "text"},
                    "trade": {"type": "keyword"},
                    "locality": {"type": "keyword"},
                    "regulation_cite": {"type": "keyword"},
                    "wage_determination_number": {"type": "keyword"},
                    "created_at": {"type": "date"}
                }
            }
        }
    )
    print(f"Created index {INDEX_NAME}")


async def seed() -> int:
    """Seed regulation chunks into Elasticsearch.
    
    Returns:
        Number of documents indexed.
    """
    es = AsyncElasticsearch([settings.elasticsearch_url])
    
    try:
        # Create index
        await create_index(es)
        
        # Index regulation chunks for each trade
        indexed = 0
        for trade, text in REGULATION_TEXTS.items():
            doc = {
                "chunk_id": f"{trade.lower().replace(' ', '_')}_001",
                "text": text,
                "trade": trade,
                "locality": "Washington, DC",
                "regulation_cite": "40 U.S.C. Section 3141-3148",
                "wage_determination_number": "DC2026-001",
                "created_at": "2026-01-01T00:00:00Z"
            }
            
            await es.index(index=INDEX_NAME, id=doc["chunk_id"], document=doc)
            indexed += 1
            print(f"Indexed chunk for {trade}")
        
        # Refresh index
        await es.indices.refresh(index=INDEX_NAME)
        
        print(f"Indexed {indexed} regulation chunks")
        return indexed
        
    finally:
        await es.close()


if __name__ == "__main__":
    asyncio.run(seed())
