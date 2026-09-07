import asyncio
from collections import defaultdict
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config.database import get_db, SessionLocal
from app.models.booking import Booking
from app.models.user import User
from app.dependencies.auth import get_current_user, require_farmer
from app.utils.security import decode_access_token

router = APIRouter(prefix='/api/queue', tags=['Live Queue'])
ACTIVE={'Confirmed','Checked In','Processing'}

def queue_snapshot(booking:Booking,db:Session):
    rows=db.scalars(select(Booking).where(Booking.centre==booking.centre,Booking.booking_date==booking.booking_date,Booking.slot==booking.slot,Booking.status!='Cancelled').order_by(Booking.created_at.asc(),Booking.id.asc())).all()
    position=next((i+1 for i,row in enumerate(rows) if row.id==booking.id),len(rows)+1)
    ahead=sum(1 for row in rows[:max(0,position-1)] if row.status in ACTIVE)
    return {'bookingId':booking.booking_id,'token':booking.token,'centre':booking.centre,'date':booking.booking_date,'slot':booking.slot,'status':booking.status,'position':position,'total':len(rows),'ahead':ahead,'estimatedWaitMinutes':max(0,ahead*15),'updatedAt':booking.updated_at.isoformat() if booking.updated_at else None}

@router.get('/mine')
def my_queue(user:User=Depends(require_farmer),db:Session=Depends(get_db)):
    rows=db.scalars(select(Booking).where(Booking.farmer_id==user.id).order_by(Booking.created_at.desc())).all()
    active=next((b for b in rows if b.status in ACTIVE),None)
    return {'active':queue_snapshot(active,db) if active else None,'bookings':[queue_snapshot(b,db) for b in rows if b.status!='Cancelled']}

@router.get('/booking/{booking_id}')
def booking_queue(booking_id:str,user:User=Depends(require_farmer),db:Session=Depends(get_db)):
    b=db.scalar(select(Booking).where(Booking.booking_id==booking_id,Booking.farmer_id==user.id))
    if not b: from fastapi import HTTPException; raise HTTPException(404,'Booking not found')
    return queue_snapshot(b,db)

class ConnectionManager:
    def __init__(self): self.rooms=defaultdict(set); self.lock=asyncio.Lock()
    async def connect(self,ws,room):
        await ws.accept()
        async with self.lock:self.rooms[room].add(ws)
    async def disconnect(self,ws,room):
        async with self.lock:
            self.rooms[room].discard(ws)
            if not self.rooms[room]:self.rooms.pop(room,None)
    async def broadcast(self,room,payload):
        async with self.lock:sockets=list(self.rooms.get(room,set()))
        for ws in sockets:
            try:await ws.send_json(payload)
            except Exception:await self.disconnect(ws,room)
manager=ConnectionManager()

async def watch_farmer(farmer_id,ws):
    last=None
    while True:
        db=SessionLocal()
        try:
            rows=db.scalars(select(Booking).where(Booking.farmer_id==farmer_id,Booking.status!='Cancelled').order_by(Booking.created_at.desc())).all()
            active=next((b for b in rows if b.status in ACTIVE),None)
            snap=queue_snapshot(active,db) if active else None
            marker=(snap or {}).get('updatedAt'),(snap or {}).get('position'),(snap or {}).get('status')
            if marker!=last:
                from datetime import datetime,timezone
                await ws.send_json({'type':'queue.updated','active':snap,'serverTime':datetime.now(timezone.utc).isoformat()});last=marker
        finally:db.close()
        await asyncio.sleep(5)

@router.websocket('/ws/{jwt_token}')
async def queue_socket(websocket:WebSocket,jwt_token:str):
    payload=decode_access_token(jwt_token)
    if not payload:await websocket.close(code=1008);return
    try: farmer_id=int(payload.get('sub'))
    except (TypeError,ValueError): await websocket.close(code=1008);return
    room=f'farmer:{farmer_id}';await manager.connect(websocket,room);watch=asyncio.create_task(watch_farmer(farmer_id,websocket))
    try:
        while True:await websocket.receive_text()
    except (WebSocketDisconnect,Exception):pass
    finally:
        watch.cancel();await manager.disconnect(websocket,room)

async def publish_farmer_update(farmer_id:int,payload:dict):await manager.broadcast(f'farmer:{farmer_id}',payload)
