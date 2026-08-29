from fastapi import APIRouter
router = APIRouter(prefix='/api/employee', tags=['Procurement Employee'])
@router.get('/ping')
def ping():
    return {'ok': True}
