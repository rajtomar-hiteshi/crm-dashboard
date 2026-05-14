import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import dashboard, connections, followups, inmails, positive_responses, leads, activity, sync, drilldown, daily_activity, settings

app = FastAPI(title="Lead Gen CRM API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://35.154.251.140", "https://35.154.251.140"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api")
app.include_router(connections.router, prefix="/api")
app.include_router(followups.router, prefix="/api")
app.include_router(inmails.router, prefix="/api")
app.include_router(positive_responses.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(drilldown.router, prefix="/api")
app.include_router(daily_activity.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "running", "app": "Lead Gen CRM API", "version": "2.0.0"}
