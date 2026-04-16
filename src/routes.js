import { Router } from 'express';

import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './modules/health/routes/health.routes.js';
import { locationRouter } from './routes/location.routes.js';
import { donorProfileRouter } from './routes/donor-profile.routes.js';
import { bloodNeedRouter, publicBloodNeedRouter } from './routes/blood-need.routes.js';
import { hospitalRouter } from './routes/hospital.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { patientRouter } from './routes/patient.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { upazilaSettingsRouter } from './routes/upazila-settings.routes.js';
import { userRouter } from './routes/user.routes.js';

export const routes = Router();

routes.use('/health', healthRouter);
routes.use('/auth', authRouter);
routes.use('/locations', locationRouter);
routes.use('/users', userRouter);
routes.use('/donor-profiles', donorProfileRouter);
routes.use('/blood-needs', publicBloodNeedRouter);
routes.use('/blood-needs', bloodNeedRouter);
routes.use('/hospitals', hospitalRouter);
routes.use('/patients', patientRouter);
routes.use('/notifications', notificationRouter);
routes.use('/reports', reportRouter);
routes.use('/upazila-settings', upazilaSettingsRouter);
