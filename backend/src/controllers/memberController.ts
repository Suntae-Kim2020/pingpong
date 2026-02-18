import { Request, Response, NextFunction } from 'express';
import { memberModel } from '../models/memberModel';
import { AppError } from '../middleware/errorHandler';

export const memberController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await memberModel.findAll();
      res.json(members);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const member = await memberModel.findById(id);
      if (!member) {
        throw new AppError('Member not found', 404);
      }
      res.json(member);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const member = await memberModel.create({
        club_id: req.body.club_id || 1,
        name: req.body.name,
        birth_year: req.body.birth_year,
        gender: req.body.gender,
        phone: req.body.phone || null,
        local_busu: req.body.local_busu || null,
        open_busu: req.body.open_busu || null,
        play_style: req.body.play_style || '올라운드',
        pimple_type: req.body.pimple_type || 'none',
        spouse_id: req.body.spouse_id || null,
        is_active: req.body.is_active !== false,
      });
      res.status(201).json(member);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await memberModel.update(id, req.body);
      const member = await memberModel.findById(id);
      res.json(member);
    } catch (error) {
      next(error);
    }
  },
};
