from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from review import router as review_router
from projects import router as projects_router
from export_router import router as export_router
from notify_router import router as notify_router
from users_router import router as users_router

app = FastAPI(title="PJMO Review API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(review_router)
app.include_router(projects_router)
app.include_router(export_router)
app.include_router(notify_router)
app.include_router(users_router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
