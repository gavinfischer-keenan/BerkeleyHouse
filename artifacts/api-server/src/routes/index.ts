import { Router, type IRouter } from "express";
import healthRouter from "./health";
import weatherRouter from "./weather";
import earthquakesRouter from "./earthquakes";
import buoysRouter from "./buoys";
import alertsRouter from "./alerts";
import airqualityRouter from "./airquality";
import aircraftRouter from "./aircraft";
import windRouter from "./wind";
import shipsRouter from "./ships";
import stationsRouter from "./stations";
import currentsRouter from "./currents";
import tideRouter from "./tide";
import turbulenceRouter from "./turbulence";
import airportRouter from "./airport";
import { uploadRouter } from "./upload.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(weatherRouter);
router.use(earthquakesRouter);
router.use(buoysRouter);
router.use(alertsRouter);
router.use(airqualityRouter);
router.use(aircraftRouter);
router.use(windRouter);
router.use(shipsRouter);
router.use(stationsRouter);
router.use(currentsRouter);
router.use(tideRouter);
router.use(turbulenceRouter);
router.use(airportRouter);
router.use("/upload", uploadRouter);

export default router;

