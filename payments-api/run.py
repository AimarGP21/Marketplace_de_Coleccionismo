import uvicorn
from app.config import HOST, PORT

if __name__ == "__main__":
    print(f"Iniciando Payments API en http://{HOST}:{PORT}")
    print(f"Documentacion Swagger interactiva disponible en: http://localhost:{PORT}/docs")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
