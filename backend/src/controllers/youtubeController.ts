import { Request, Response, NextFunction } from 'express';
import { youtubeModel } from '../models/youtubeModel';
import { AppError } from '../middleware/errorHandler';

export const youtubeController = {
  async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const videos = await youtubeModel.getActive();
      res.json(videos);
    } catch (error) {
      next(error);
    }
  },

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const videos = await youtubeModel.getAll();
      res.json(videos);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { video_type, youtube_url, youtube_id, title, display_order } = req.body;
      if (!video_type || !youtube_url || !youtube_id || !title) {
        throw new AppError('video_type, youtube_url, youtube_id, title are required', 400);
      }
      const video = await youtubeModel.create({ video_type, youtube_url, youtube_id, title, display_order });
      res.status(201).json(video);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const video = await youtubeModel.update(id, req.body);
      if (!video) {
        throw new AppError('Video not found', 404);
      }
      res.json(video);
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const deleted = await youtubeModel.delete(id);
      if (!deleted) {
        throw new AppError('Video not found', 404);
      }
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
};
