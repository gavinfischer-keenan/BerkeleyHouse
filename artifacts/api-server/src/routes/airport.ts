import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

const AIRPORTS = ["SFO", "OAK", "SJC"];

function extractAirportStatus(airportCode: string, data: any[]) {
    const entry = data.find((a: any) => a.airportId === airportCode);

    let status = "NORMAL OPERATIONS";
    let color = "#1dd1a1"; // Green
    let details = "No known delays or closures at this time.";

    if (entry) {
        if (entry.airportClosure) {
            status = "AIRPORT CLOSED";
            color = "#ee5253"; // Red
            details = entry.airportClosure.simpleText || "Runways closed.";
        } else if (entry.groundStop) {
            status = "GROUND STOP";
            color = "#ee5253"; // Red
            details = `Reason: ${entry.groundStop.impactingCondition || 'Unknown'}. End: ${new Date(entry.groundStop.endTime).toLocaleTimeString()}`;
        } else if (entry.groundDelay) {
            status = "GROUND DELAY";
            color = "#ff9f43"; // Orange
            details = `Avg delay: ${entry.groundDelay.avgDelay} min. Reason: ${entry.groundDelay.impactingCondition || 'Unknown'}.`;
        } else if (entry.departureDelay) {
            status = "DEPARTURE DELAY";
            color = "#fdcb6e"; // Yellow
            details = `Delay: ${entry.departureDelay.arrivalDeparture?.min || ''} - ${entry.departureDelay.arrivalDeparture?.max || ''}. Reason: ${entry.departureDelay.reason || 'Unknown'}`;
        } else if (entry.arrivalDelay) {
            status = "ARRIVAL DELAY";
            color = "#fdcb6e"; // Yellow
            details = `Reason: ${entry.arrivalDelay.reason || 'Unknown'}`;
        } else if (entry.freeForm) {
            status = "ADVISORY";
            color = "#a29bfe"; // Purple
            details = entry.freeForm.text || entry.freeForm.simpleText || "General advisory.";
        }
    }

    return { code: airportCode, status, color, details };
}

router.get("/airport", async (req: Request, res: Response) => {
    try {
        const response = await fetch("https://nasstatus.faa.gov/api/airport-events", { signal: AbortSignal.timeout(8000),
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        
        if (!response.ok) {
            throw new Error(`FAA API returned ${response.status}`);
        }
        
        const data = await response.json() as any[];
        const airports = AIRPORTS.map((code) => extractAirportStatus(code, data));
        
        res.json({ airports, fetchedAt: Date.now() });
    } catch (error: any) {
        logger.error({ err: error }, "Error fetching airport status");
        res.json({
            airports: AIRPORTS.map((code) => ({
                code,
                status: "STATUS UNAVAILABLE",
                color: "#636e72",
                details: "Could not fetch data from FAA systems."
            })),
            fetchedAt: Date.now()
        });
    }
});

export default router;

