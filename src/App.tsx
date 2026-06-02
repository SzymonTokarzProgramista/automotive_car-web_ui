import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  CircleDot,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Map,
  Navigation,
  RadioTower,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { api } from "./api";
import type { AppView, AuthMode, MapDefinition, PickMode, Point, RouteRead, User } from "./types";

const TOKEN_STORAGE_KEY = "automotive_car_access_token";

function formatPoint(point: Point | null): string {
  if (!point) {
    return "Not selected";
  }
  return `${point.x.toFixed(1)}, ${point.y.toFixed(1)}`;
}

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>("home");
  const [authMessage, setAuthMessage] = useState("Sign in to open the operator console.");
  const [maps, setMaps] = useState<MapDefinition[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>("");
  const [currentRoute, setCurrentRoute] = useState<RouteRead | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>("start");
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);

  const selectedMap = useMemo(
    () => maps.find((mapItem) => mapItem.map_id === selectedMapId) ?? maps[0],
    [maps, selectedMapId],
  );

  function clearSession() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setMaps([]);
    setCurrentRoute(null);
    setStart(null);
    setEnd(null);
    setView("home");
  }

  async function loadWorkspace(accessToken: string) {
    try {
      setIsBusy(true);
      const [me, catalog] = await Promise.all([api.me(accessToken), api.maps(accessToken)]);
      setUser(me);
      setMaps(catalog.maps);
      setSelectedMapId((current) => current || catalog.maps[0]?.map_id || "");

      try {
        setCurrentRoute(await api.currentRoute(accessToken));
      } catch (error) {
        if ((error as Error).name === "401") {
          throw error;
        }
        setCurrentRoute(null);
      }
      setStatus("Connected");
    } catch (error) {
      if ((error as Error).name === "401") {
        clearSession();
      }
      setStatus("Connection failed");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (token) {
      void loadWorkspace(token);
    }
  }, [token]);

  useEffect(() => {
    const verificationToken = new URLSearchParams(window.location.search).get("verify_email_token");
    if (!verificationToken) {
      return;
    }

    void api
      .verifyEmail(verificationToken)
      .then(() => {
        window.history.replaceState({}, "", window.location.pathname);
        setAuthMessage("Email verified. You can now log in.");
        setView("auth");
      })
      .catch(() => {
        window.history.replaceState({}, "", window.location.pathname);
        setAuthMessage("Email verification failed or the link has expired.");
        setView("auth");
      });
  }, []);

  async function handleAuth(accessToken: string) {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);
    await loadWorkspace(accessToken);
    setView("console");
  }

  async function saveRoute() {
    if (!token || !selectedMap || !start || !end) {
      setStatus("Select map, start, and finish");
      return;
    }

    try {
      setIsBusy(true);
      const route = await api.saveRoute(token, selectedMap.map_id, start, end);
      setCurrentRoute(route);
      setStatus("Route saved");
    } catch (error) {
      if ((error as Error).name === "401") {
        clearSession();
        return;
      }
      setStatus("Route save failed");
    } finally {
      setIsBusy(false);
    }
  }

  if (view === "auth") {
    return <AuthScreen initialMessage={authMessage} onAuthenticated={handleAuth} onBackHome={() => setView("home")} />;
  }

  if (view !== "console") {
    return (
      <LandingPage
        user={user}
        onLogin={() => setView("auth")}
        onOpenConsole={() => {
          if (token && user) {
            setView("console");
          } else {
            setView("auth");
          }
        }}
      />
    );
  }

  if (!token || !user) {
    return <AuthScreen initialMessage={authMessage} onAuthenticated={handleAuth} onBackHome={() => setView("home")} />;
  }

  return (
    <OperatorConsole
      token={token}
      user={user}
      maps={maps}
      selectedMap={selectedMap}
      selectedMapId={selectedMapId}
      currentRoute={currentRoute}
      start={start}
      end={end}
      pickMode={pickMode}
      status={status}
      isBusy={isBusy}
      onBackHome={() => setView("home")}
      onLogout={clearSession}
      onSelectMap={(mapId) => {
        setSelectedMapId(mapId);
        setStart(null);
        setEnd(null);
      }}
      onPickMode={setPickMode}
      onPickPoint={(point) => {
        if (pickMode === "start") {
          setStart(point);
          setPickMode("end");
        } else {
          setEnd(point);
        }
      }}
      onSaveRoute={saveRoute}
    />
  );
}

function LandingPage({
  user,
  onLogin,
  onOpenConsole,
}: {
  user: User | null;
  onLogin: () => void;
  onOpenConsole: () => void;
}) {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <div className="brand">
          <div className="brand-mark">
            <RadioTower size={22} />
          </div>
          <div>
            <strong>Autonomous Control</strong>
            <span>Engineering console</span>
          </div>
        </div>
        <div className="landing-menu">
          <a href="#project">Project</a>
          <a href="#system">Autonomy Stack</a>
          <button className="nav-link" type="button" onClick={onOpenConsole}>
            Console
          </button>
          <button className="login-chip" type="button" onClick={user ? onOpenConsole : onLogin}>
            {user ? <ShieldCheck size={16} /> : <LogIn size={16} />}
            {user ? "Open" : "Login to Workspace"}
          </button>
        </div>
      </nav>

      <section className="hero-section reveal-section" id="project">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} />
            RL-based autonomous vehicle platform
          </span>
          <h1>Train, monitor, and deploy autonomous driving policies for a model urban vehicle.</h1>
          <p>
            From reinforcement learning in simulation to real-time perception and route execution
            on the physical vehicle.
          </p>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={onOpenConsole}>
              <Navigation size={18} />
              Open Driving Console
            </button>
            <a className="secondary-action" href="#system">
              View Autonomy Stack
            </a>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-grid" />
          <span className="route-caption">Simulated urban route</span>
          <div className="visual-car">
            <Navigation size={42} />
          </div>
          <div className="visual-path" />
          <div className="visual-node start">A</div>
          <div className="visual-node end">B</div>
          <div className="visual-obstacle pedestrian" />
          <div className="visual-obstacle block" />
          <div className="lane-mark lane-one" />
          <div className="lane-mark lane-two" />
        </div>
      </section>

      <section className="info-band reveal-section" id="system">
        <article>
          <Camera size={22} />
          <h2>Real-time Perception</h2>
          <p>Live camera stream with pedestrian, lane, obstacle, and road-feature detection used by the driving stack.</p>
        </article>
        <article>
          <Route size={22} />
          <h2>RL Driving Policy</h2>
          <p>Reinforcement learning policy trained in simulation to support steering, speed control, and local driving decisions.</p>
        </article>
        <article>
          <Target size={22} />
          <h2>Urban Route Execution</h2>
          <p>Point-to-point navigation through a selected urban map, combining global route goals with local obstacle-aware control.</p>
        </article>
        <article>
          <RadioTower size={22} />
          <h2>Vehicle Telemetry</h2>
          <p>Runtime monitoring of position, sensor state, control commands, inference status, and system health.</p>
        </article>
      </section>

      <section className="story-section reveal-section">
        <div>
          <span className="eyebrow">Project Flow</span>
          <h2>From simulated training to autonomous route execution.</h2>
        </div>
        <div className="timeline">
          <div>
            <strong>01</strong>
            <span>
              <b>Train policy in simulation</b>
              Use simulated urban scenarios to train and evaluate the RL driving agent.
            </span>
          </div>
          <div>
            <strong>02</strong>
            <span>
              <b>Load map and mission goal</b>
              Select an urban environment and define the target route from point A to point B.
            </span>
          </div>
          <div>
            <strong>03</strong>
            <span>
              <b>Run perception stack</b>
              Process camera input to detect pedestrians, lanes, obstacles, and road context.
            </span>
          </div>
          <div>
            <strong>04</strong>
            <span>
              <b>Execute autonomous drive</b>
              Combine route intent, perception, and RL policy outputs into steering and speed commands.
            </span>
          </div>
          <div>
            <strong>05</strong>
            <span>
              <b>Monitor telemetry and safety</b>
              Observe vehicle state, detections, control signals, and intervention conditions in real time.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

function OperatorConsole({
  token,
  user,
  maps,
  selectedMap,
  currentRoute,
  start,
  end,
  pickMode,
  status,
  isBusy,
  onBackHome,
  onLogout,
  onSelectMap,
  onPickMode,
  onPickPoint,
  onSaveRoute,
}: {
  token: string;
  user: User;
  maps: MapDefinition[];
  selectedMap: MapDefinition | undefined;
  selectedMapId: string;
  currentRoute: RouteRead | null;
  start: Point | null;
  end: Point | null;
  pickMode: PickMode;
  status: string;
  isBusy: boolean;
  onBackHome: () => void;
  onLogout: () => void;
  onSelectMap: (mapId: string) => void;
  onPickMode: (mode: PickMode) => void;
  onPickPoint: (point: Point) => void;
  onSaveRoute: () => void;
}) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" type="button" onClick={onBackHome}>
          <div className="brand-mark">
            <RadioTower size={22} />
          </div>
          <div>
            <strong>Autonomous Control</strong>
            <span>Vehicle route console</span>
          </div>
        </button>

        <div className="status-strip">
          <span className="status-pill">
            <CheckCircle2 size={16} />
            {status}
          </span>
          <span className="user-chip">
            <ShieldCheck size={16} />
            {user.email}
          </span>
          <button className="icon-button" type="button" onClick={onLogout} aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="dashboard">
        <aside className="panel sidebar">
          <div className="section-title">
            <Map size={18} />
            <h2>Maps</h2>
          </div>
          <div className="map-list">
            {maps.map((mapItem) => (
              <button
                className={`map-option ${mapItem.map_id === selectedMap?.map_id ? "active" : ""}`}
                key={mapItem.id}
                type="button"
                onClick={() => onSelectMap(mapItem.map_id)}
              >
                <span>{mapItem.name}</span>
                <small>
                  {mapItem.width} x {mapItem.height} {mapItem.coordinate_unit}
                </small>
              </button>
            ))}
          </div>

          <div className="route-card">
            <div className="section-title">
              <Route size={18} />
              <h2>Current Route</h2>
            </div>
            {currentRoute ? (
              <dl className="route-data">
                <dt>Map</dt>
                <dd>{currentRoute.map_id}</dd>
                <dt>Start</dt>
                <dd>{formatPoint(currentRoute.start)}</dd>
                <dt>Finish</dt>
                <dd>{formatPoint(currentRoute.end)}</dd>
              </dl>
            ) : (
              <p className="muted">No route saved for this user.</p>
            )}
          </div>
        </aside>

        <section className="panel map-workspace">
          <div className="workspace-header">
            <div>
              <div className="section-title">
                <Target size={18} />
                <h2>Route Planner</h2>
              </div>
              <p>{selectedMap?.description ?? "No map available."}</p>
            </div>
            <div className={`segmented choice-tabs ${pickMode}`}>
              <span className="choice-indicator" />
              <button className={pickMode === "start" ? "active" : ""} type="button" onClick={() => onPickMode("start")}>
                Start
              </button>
              <button className={pickMode === "end" ? "active" : ""} type="button" onClick={() => onPickMode("end")}>
                Finish
              </button>
            </div>
          </div>

          {selectedMap ? (
            <RouteMap
              mapDefinition={selectedMap}
              start={start}
              end={end}
              pickMode={pickMode}
              onPick={onPickPoint}
            />
          ) : (
            <div className="empty-state">No maps found.</div>
          )}

          <div className="planner-footer">
            <Metric label="Start" value={formatPoint(start)} />
            <Metric label="Finish" value={formatPoint(end)} />
            <button className="primary-action" type="button" onClick={onSaveRoute} disabled={isBusy || !start || !end}>
              <Save size={18} />
              Save Route
            </button>
          </div>
        </section>

        <aside className="panel camera-panel">
          <div className="section-title">
            <Camera size={18} />
            <h2>Camera</h2>
          </div>
          <div className="camera-frame">
            <img src={api.cameraUrl(token)} alt="Vehicle camera stream" />
            <div className="scanline" />
          </div>
          <div className="telemetry">
            <Metric label="API" value={api.apiUrl} />
            <Metric label="Mode" value={pickMode === "start" ? "Picking start" : "Picking finish"} />
          </div>
        </aside>
      </section>
    </main>
  );
}

function AuthScreen({
  initialMessage,
  onAuthenticated,
  onBackHome,
}: {
  initialMessage: string;
  onAuthenticated: (token: string) => Promise<void>;
  onBackHome: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("driver@example.com");
  const [password, setPassword] = useState("secret-password");
  const [confirmPassword, setConfirmPassword] = useState("secret-password");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "register" && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsBusy(true);
    setMessage(mode === "login" ? "Logging in..." : "Creating account...");

    try {
      if (mode === "register") {
        await api.register(email, password);
        setMessage("Account created. Check your email and confirm the address before logging in.");
        setMode("login");
        return;
      }
      const tokenResponse = await api.login(email, password);
      await onAuthenticated(tokenResponse.access_token);
    } catch {
      setMessage(mode === "login" ? "Invalid credentials or backend unavailable." : "Registration failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <button className="auth-back" type="button" onClick={onBackHome}>
        Back to project
      </button>
      <form className="auth-panel" onSubmit={submit}>
        <div className="brand auth-brand">
          <div className="brand-mark">
            <Navigation size={24} />
          </div>
          <div>
            <strong>Autonomous Control</strong>
            <span>Operator access</span>
          </div>
        </div>

        <div className={`auth-tabs choice-tabs ${mode}`}>
          <span className="choice-indicator" />
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>
            Register
          </button>
        </div>

        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <span className="password-control">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <div className={`confirm-password ${mode === "register" ? "visible" : ""}`} aria-hidden={mode !== "register"}>
          <label>
            Confirm password
            <span className="password-control">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required={mode === "register"}
                tabIndex={mode === "register" ? 0 : -1}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                tabIndex={mode === "register" ? 0 : -1}
                aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
        </div>

        <button className="primary-action wide" type="submit" disabled={isBusy}>
          <LogIn size={18} />
          {mode === "login" ? "Login" : "Register"}
        </button>

        <p className="muted">{message}</p>
      </form>
    </main>
  );
}

function RouteMap({
  mapDefinition,
  start,
  end,
  pickMode,
  onPick,
}: {
  mapDefinition: MapDefinition;
  start: Point | null;
  end: Point | null;
  pickMode: PickMode;
  onPick: (point: Point) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  function pickPoint(event: MouseEvent<HTMLDivElement>) {
    const element = mapRef.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * mapDefinition.width;
    const y = ((event.clientY - rect.top) / rect.height) * mapDefinition.height;
    onPick({
      x: Math.max(0, Math.min(mapDefinition.width, x)),
      y: Math.max(0, Math.min(mapDefinition.height, y)),
    });
  }

  return (
    <div
      ref={mapRef}
      className="route-map"
      onClick={pickPoint}
      style={{ aspectRatio: `${mapDefinition.width} / ${mapDefinition.height}` }}
    >
      <div className="map-grid" />
      <div className={`map-scanner ${pickMode}`} />
      <div className="radar-sweep" />
      <div className="route-line" />
      {start && <Marker point={start} mapDefinition={mapDefinition} kind="start" />}
      {end && <Marker point={end} mapDefinition={mapDefinition} kind="end" />}
      <div className="map-hint">
        <CircleDot size={16} />
        Click to set {pickMode}
      </div>
    </div>
  );
}

function Marker({
  point,
  mapDefinition,
  kind,
}: {
  point: Point;
  mapDefinition: MapDefinition;
  kind: PickMode;
}) {
  return (
    <div
      className={`marker ${kind}`}
      style={{
        left: `${(point.x / mapDefinition.width) * 100}%`,
        top: `${(point.y / mapDefinition.height) * 100}%`,
      }}
    >
      {kind === "start" ? "S" : "F"}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
