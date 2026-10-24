import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.reading_sessions import Reading_sessionsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/reading_sessions", tags=["reading_sessions"])


# ---------- Pydantic Schemas ----------
class Reading_sessionsData(BaseModel):
    """Entity data schema (for create/update)"""
    share_id: str
    goal: str
    paper_id: str = None
    language: str
    answer: str
    plan_json: str = None
    notes_json: str = None
    sources_json: str = None
    self_check: str = None
    steps_json: str = None
    prompt_tokens: int = None
    completion_tokens: int = None
    total_tokens: int = None
    turns: int = None
    visitor: str = None


class Reading_sessionsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    share_id: Optional[str] = None
    goal: Optional[str] = None
    paper_id: Optional[str] = None
    language: Optional[str] = None
    answer: Optional[str] = None
    plan_json: Optional[str] = None
    notes_json: Optional[str] = None
    sources_json: Optional[str] = None
    self_check: Optional[str] = None
    steps_json: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    turns: Optional[int] = None
    visitor: Optional[str] = None


class Reading_sessionsResponse(BaseModel):
    """Entity response schema"""
    id: int
    share_id: str
    goal: str
    paper_id: Optional[str] = None
    language: str
    answer: str
    plan_json: Optional[str] = None
    notes_json: Optional[str] = None
    sources_json: Optional[str] = None
    self_check: Optional[str] = None
    steps_json: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    turns: Optional[int] = None
    visitor: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Reading_sessionsListResponse(BaseModel):
    """List response schema"""
    items: List[Reading_sessionsResponse]
    total: int
    skip: int
    limit: int


class Reading_sessionsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Reading_sessionsData]


class Reading_sessionsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Reading_sessionsUpdateData


class Reading_sessionsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Reading_sessionsBatchUpdateItem]


class Reading_sessionsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Reading_sessionsListResponse)
async def query_reading_sessionss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query reading_sessionss with filtering, sorting, and pagination"""
    logger.debug(f"Querying reading_sessionss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Reading_sessionsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} reading_sessionss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid reading_sessions query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying reading_sessionss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Reading_sessionsListResponse)
async def query_reading_sessionss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query reading_sessionss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying reading_sessionss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Reading_sessionsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} reading_sessionss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid reading_sessions query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying reading_sessionss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Reading_sessionsResponse)
async def get_reading_sessions(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single reading_sessions by ID"""
    logger.debug(f"Fetching reading_sessions with id: {id}, fields={fields}")
    
    service = Reading_sessionsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Reading_sessions with id {id} not found")
            raise HTTPException(status_code=404, detail="Reading_sessions not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching reading_sessions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Reading_sessionsResponse, status_code=201)
async def create_reading_sessions(
    data: Reading_sessionsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new reading_sessions"""
    logger.debug(f"Creating new reading_sessions with data: {data}")
    
    service = Reading_sessionsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create reading_sessions")
        
        logger.info(f"Reading_sessions created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating reading_sessions: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating reading_sessions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Reading_sessionsResponse], status_code=201)
async def create_reading_sessionss_batch(
    request: Reading_sessionsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple reading_sessionss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} reading_sessionss")
    
    service = Reading_sessionsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} reading_sessionss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Reading_sessionsResponse])
async def update_reading_sessionss_batch(
    request: Reading_sessionsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple reading_sessionss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} reading_sessionss")
    
    service = Reading_sessionsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} reading_sessionss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Reading_sessionsResponse)
async def update_reading_sessions(
    id: int,
    data: Reading_sessionsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing reading_sessions"""
    logger.debug(f"Updating reading_sessions {id} with data: {data}")

    service = Reading_sessionsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Reading_sessions with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Reading_sessions not found")
        
        logger.info(f"Reading_sessions {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating reading_sessions {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating reading_sessions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_reading_sessionss_batch(
    request: Reading_sessionsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple reading_sessionss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} reading_sessionss")
    
    service = Reading_sessionsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} reading_sessionss successfully")
        return {"message": f"Successfully deleted {deleted_count} reading_sessionss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_reading_sessions(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single reading_sessions by ID"""
    logger.debug(f"Deleting reading_sessions with id: {id}")
    
    service = Reading_sessionsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Reading_sessions with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Reading_sessions not found")
        
        logger.info(f"Reading_sessions {id} deleted successfully")
        return {"message": "Reading_sessions deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting reading_sessions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")