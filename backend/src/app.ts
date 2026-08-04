import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes";
import memberRoutes from "./routes/members.routes";
import familyRoutes from "./routes/family.routes";
import collectionRoutes from "./routes/collections.routes";
import loanRoutes from "./routes/loans.routes";
import transactionRoutes from "./routes/transactions.routes";
import notificationRoutes from "./routes/notifications.routes";
import settingsRoutes from "./routes/settings.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import reportRoutes from "./routes/reports.routes";
import devRoutes from "./routes/dev.routes";
import { errorHandler, notFound } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use("/api", apiLimiter);

app.get("/api/health", (_req, res) => res.json({ success: true, service: "Fair Savings API", status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/family", familyRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dev", devRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
