from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from systems_router  import router as systems_router
from projects_router import router as projects_router
from threads_router  import router as threads_router
from io_router       import router as io_router
from advisor_router  import router as advisor_router
from export_router   import router as export_router
from notify_router   import router as notify_router
from users_router    import router as users_router

app = FastAPI(title="予算額妥当性評価システム API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(systems_router)
app.include_router(projects_router)
app.include_router(threads_router)
app.include_router(io_router)
app.include_router(advisor_router)
app.include_router(export_router)
app.include_router(notify_router)
app.include_router(users_router)

# uploads ディレクトリを静的配信
uploads_dir = "/app/uploads"
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
