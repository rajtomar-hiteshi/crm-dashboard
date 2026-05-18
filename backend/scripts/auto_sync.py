#!/usr/bin/env python3
"""
Auto-sync cron script — runs incremental sync daily at midnight IST.
Logs to /home/ec2-user/leadgen-crm/logs/auto_sync.log
"""
import sys, os, logging
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, 'auto_sync.log')),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def main():
    start = datetime.utcnow()
    logger.info("=" * 50)
    logger.info(f"Auto-sync started at {start.isoformat()} UTC")

    try:
        from database import SessionLocal
        from services.sync_service import run_incremental_sync

        db = SessionLocal()
        try:
            result = run_incremental_sync(db)
            logger.info(f"Sync result: {result.get('status', 'unknown')}")
            logger.info(f"  Files synced: {result.get('files_synced', 0)}")
            logger.info(f"  New rows added: {result.get('new_rows_added', 0)}")
            logger.info(f"  Rows skipped (dupes): {result.get('rows_skipped', 0)}")
            if result.get('details'):
                for d in result['details']:
                    logger.info(f"  {d.get('person', '?')}: +{d.get('new_rows', 0)} new, {d.get('skipped', 0)} skipped")
        except Exception as e:
            logger.error(f"Sync failed: {e}", exc_info=True)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to initialize: {e}", exc_info=True)

    elapsed = (datetime.utcnow() - start).total_seconds()
    logger.info(f"Auto-sync finished in {elapsed:.1f}s")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()
