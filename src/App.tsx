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
  Cpu,
  RadioTower,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { api } from "./api";
import { translations } from "./translations";
import type { Language, Translation } from "./translations";
import type { AppView, AuthMode, MapDefinition, PickMode, Point, RouteRead, User } from "./types";

const TOKEN_STORAGE_KEY = "automotive_car_access_token";
const LANGUAGE_STORAGE_KEY = "automotive_car_language";
type StatusKey = keyof Translation["status"];

function formatPoint(point: Point | null, notSelectedLabel: string): string {
  if (!point) {
    return notSelectedLabel;
  }
  return `${point.x.toFixed(1)}, ${point.y.toFixed(1)}`;
}

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [language, setLanguage] = useState<Language>(() => {
    const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return storedLanguage === "polish" ? "polish" : "english";
  });
  const copy = translations[language];

  function toggleLanguage() {
    setLanguage((currentLanguage) => {
      const nextLanguage = currentLanguage === "english" ? "polish" : "english";
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      return nextLanguage;
    });
  }

  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>("home");
  const [authMessage, setAuthMessage] = useState(copy.auth.initialMessage);
  const [maps, setMaps] = useState<MapDefinition[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>("");
  const [currentRoute, setCurrentRoute] = useState<RouteRead | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>("start");
  const [statusKey, setStatusKey] = useState<StatusKey>("ready");
  const status = copy.status[statusKey];
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
      setStatusKey("connected");
    } catch (error) {
      if ((error as Error).name === "401") {
        clearSession();
      }
      setStatusKey("connectionFailed");
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
        setAuthMessage(copy.auth.emailVerified);
        setView("auth");
      })
      .catch(() => {
        window.history.replaceState({}, "", window.location.pathname);
        setAuthMessage(copy.auth.emailVerificationFailed);
        setView("auth");
      });
  }, [copy.auth.emailVerificationFailed, copy.auth.emailVerified]);

  async function handleAuth(accessToken: string) {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);
    await loadWorkspace(accessToken);
    setView("console");
  }

  async function saveRoute() {
    if (!token || !selectedMap || !start || !end) {
      setStatusKey("selectRoute");
      return;
    }

    try {
      setIsBusy(true);
      const route = await api.saveRoute(token, selectedMap.map_id, start, end);
      setCurrentRoute(route);
      setStatusKey("routeSaved");
    } catch (error) {
      if ((error as Error).name === "401") {
        clearSession();
        return;
      }
      setStatusKey("routeSaveFailed");
    } finally {
      setIsBusy(false);
    }
  }

  if (view === "auth") {
    return (
      <AuthScreen
        copy={copy}
        language={language}
        initialMessage={authMessage}
        onAuthenticated={handleAuth}
        onBackHome={() => setView("home")}
        onToggleLanguage={toggleLanguage}
      />
    );
  }

  if (view !== "console") {
    return (
      <LandingPage
        copy={copy}
        language={language}
        user={user}
        onLogin={() => setView("auth")}
        onToggleLanguage={toggleLanguage}
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
    return (
      <AuthScreen
        copy={copy}
        language={language}
        initialMessage={authMessage}
        onAuthenticated={handleAuth}
        onBackHome={() => setView("home")}
        onToggleLanguage={toggleLanguage}
      />
    );
  }

  return (
    <OperatorConsole
      token={token}
      copy={copy}
      language={language}
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
      onToggleLanguage={toggleLanguage}
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
  copy,
  language,
  user,
  onLogin,
  onOpenConsole,
  onToggleLanguage,
}: {
  copy: Translation;
  language: Language;
  user: User | null;
  onLogin: () => void;
  onOpenConsole: () => void;
  onToggleLanguage: () => void;
}) {
  useEffect(() => {
    const revealElements = Array.from(document.querySelectorAll<HTMLElement>(".reveal-section"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.18 },
    );

    revealElements.forEach((element) => observer.observe(element));

    function updateScrollProgress() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      document.documentElement.style.setProperty("--scroll-progress", `${Math.min(progress, 1)}`);
    }

    updateScrollProgress();
    window.addEventListener("scroll", updateScrollProgress, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateScrollProgress);
      document.documentElement.style.removeProperty("--scroll-progress");
    };
  }, []);

  return (
    <main className="landing-shell">
      <div className="scroll-progress" aria-hidden="true" />
      <nav className="landing-nav">
        <div className="brand">
          <div className="brand-mark">
            <RadioTower size={22} />
          </div>
          <div>
            <strong>{copy.brand.name}</strong>
            <span>{copy.brand.landingSubtitle}</span>
          </div>
        </div>
        <div className="landing-menu">
          <a href="#project">{copy.common.project}</a>
          <a href="#system">{copy.common.autonomyStack}</a>
          <button className="nav-link" type="button" onClick={onOpenConsole}>
            {copy.common.console}
          </button>
          <button className="language-toggle" type="button" onClick={onToggleLanguage}>
            {language === "english" ? "PL" : "EN"}
          </button>
          <button className="login-chip" type="button" onClick={user ? onOpenConsole : onLogin}>
            {user ? <ShieldCheck size={16} /> : <LogIn size={16} />}
            {user ? copy.common.open : copy.auth.loginToWorkspace}
          </button>
        </div>
      </nav>

      <section className="hero-section reveal-section" id="project">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} />
            {copy.landing.badge}
          </span>
          <h1>{copy.landing.headline}</h1>
          <p>{copy.landing.description}</p>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={onOpenConsole}>
              <Navigation size={18} />
              {copy.landing.openConsole}
            </button>
            <a className="secondary-action" href="#system">
              {copy.landing.systemOverview}
            </a>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-grid" />
          <span className="route-caption">{copy.landing.routeCaption}</span>
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
        {copy.landing.cards.map((card, index) => {
          const Icon = [Camera, Route, Target, RadioTower][index];
          return (
            <article key={card.title}>
              <Icon size={22} />
              <h2>{card.title}</h2>
              <p>{card.text}</p>
            </article>
          );
        })}
      </section>

      <section className="story-section reveal-section">
        <div>
          <span className="eyebrow">{copy.landing.flowEyebrow}</span>
          <h2>{copy.landing.flowTitle}</h2>
        </div>
        <div className="timeline">
          {copy.landing.flow.map((step, index) => (
            <div key={step.title}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <span>
                <b>{step.title}</b>
                {step.text}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="author-section reveal-section">
        <div className="author-header">
          <div className="author-mark">
            <Cpu size={28} />
          </div>
          <div>
            <span className="eyebrow">{copy.landing.authorEyebrow}</span>
            <h2>{copy.landing.authorTitle}</h2>
            <p>{copy.landing.authorDescription}</p>
          </div>
        </div>

        <div className="author-body">
          <div className="author-note">
            <p>{copy.landing.authorNote}</p>
            <ul className="skill-list">
              {copy.landing.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
            <div className="author-links" aria-label={copy.landing.authorLinksLabel}>
              {copy.landing.authorLinks.map((linkLabel) => (
                <span key={linkLabel}>{linkLabel}</span>
              ))}
            </div>
          </div>

          <div className="author-cards">
            {copy.landing.authorCards.map((card) => (
              <article key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function OperatorConsole({
  token,
  copy,
  language,
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
  onToggleLanguage,
  onSelectMap,
  onPickMode,
  onPickPoint,
  onSaveRoute,
}: {
  token: string;
  copy: Translation;
  language: Language;
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
  onToggleLanguage: () => void;
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
            <strong>{copy.brand.name}</strong>
            <span>{copy.brand.consoleSubtitle}</span>
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
          <button className="language-toggle" type="button" onClick={onToggleLanguage}>
            {language === "english" ? "PL" : "EN"}
          </button>
          <button className="icon-button" type="button" onClick={onLogout} aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="dashboard">
        <aside className="panel sidebar">
          <div className="section-title">
            <Map size={18} />
            <h2>{copy.console.maps}</h2>
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
              <h2>{copy.console.currentRoute}</h2>
            </div>
            {currentRoute ? (
              <dl className="route-data">
                <dt>{copy.console.map}</dt>
                <dd>{currentRoute.map_id}</dd>
                <dt>{copy.console.start}</dt>
                <dd>{formatPoint(currentRoute.start, copy.common.notSelected)}</dd>
                <dt>{copy.console.finish}</dt>
                <dd>{formatPoint(currentRoute.end, copy.common.notSelected)}</dd>
              </dl>
            ) : (
              <p className="muted">{copy.console.noRoute}</p>
            )}
          </div>
        </aside>

        <section className="panel map-workspace">
          <div className="workspace-header">
            <div>
              <div className="section-title">
                <Target size={18} />
                <h2>{copy.console.routePlanner}</h2>
              </div>
              <p>{selectedMap?.description ?? copy.console.noMap}</p>
            </div>
            <div className={`segmented choice-tabs ${pickMode}`}>
              <span className="choice-indicator" />
              <button className={pickMode === "start" ? "active" : ""} type="button" onClick={() => onPickMode("start")}>
                {copy.console.start}
              </button>
              <button className={pickMode === "end" ? "active" : ""} type="button" onClick={() => onPickMode("end")}>
                {copy.console.finish}
              </button>
            </div>
          </div>

          {selectedMap ? (
            <RouteMap
              copy={copy}
              mapDefinition={selectedMap}
              start={start}
              end={end}
              pickMode={pickMode}
              onPick={onPickPoint}
            />
          ) : (
            <div className="empty-state">{copy.console.noMapsFound}</div>
          )}

          <div className="planner-footer">
            <Metric label={copy.console.start} value={formatPoint(start, copy.common.notSelected)} />
            <Metric label={copy.console.finish} value={formatPoint(end, copy.common.notSelected)} />
            <button className="primary-action" type="button" onClick={onSaveRoute} disabled={isBusy || !start || !end}>
              <Save size={18} />
              {copy.console.saveRoute}
            </button>
          </div>
        </section>

        <aside className="panel camera-panel">
          <div className="section-title">
            <Camera size={18} />
            <h2>{copy.console.camera}</h2>
          </div>
          <div className="camera-frame">
            <img src={api.cameraUrl(token)} alt="Vehicle camera stream" />
            <div className="scanline" />
          </div>
          <div className="telemetry">
            <Metric label={copy.console.api} value={api.apiUrl} />
            <Metric label={copy.console.mode} value={pickMode === "start" ? copy.console.pickingStart : copy.console.pickingFinish} />
          </div>
        </aside>
      </section>
    </main>
  );
}

function AuthScreen({
  copy,
  language,
  initialMessage,
  onAuthenticated,
  onBackHome,
  onToggleLanguage,
}: {
  copy: Translation;
  language: Language;
  initialMessage: string;
  onAuthenticated: (token: string) => Promise<void>;
  onBackHome: () => void;
  onToggleLanguage: () => void;
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
      setMessage(copy.auth.passwordsDoNotMatch);
      return;
    }

    setIsBusy(true);
    setMessage(mode === "login" ? copy.auth.loggingIn : copy.auth.creatingAccount);

    try {
      if (mode === "register") {
        await api.register(email, password);
        setMessage(copy.auth.accountCreated);
        setMode("login");
        return;
      }
      const tokenResponse = await api.login(email, password);
      await onAuthenticated(tokenResponse.access_token);
    } catch {
      setMessage(mode === "login" ? copy.auth.invalidLogin : copy.auth.registrationFailed);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <button className="auth-back" type="button" onClick={onBackHome}>
        {copy.common.backToProject}
      </button>
      <form className="auth-panel" onSubmit={submit}>
        <div className="brand auth-brand">
          <div className="brand-mark">
            <Navigation size={24} />
          </div>
          <div>
            <strong>{copy.brand.name}</strong>
            <span>{copy.auth.operatorAccess}</span>
          </div>
        </div>

        <button className="language-toggle auth-language-toggle" type="button" onClick={onToggleLanguage}>
          {language === "english" ? "PL" : "EN"}
        </button>

        <div className={`auth-tabs choice-tabs ${mode}`}>
          <span className="choice-indicator" />
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            {copy.common.login}
          </button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>
            {copy.common.register}
          </button>
        </div>

        <label>
          {copy.common.email}
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          {copy.common.password}
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
              aria-label={showPassword ? copy.auth.hidePassword : copy.auth.showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <div className={`confirm-password ${mode === "register" ? "visible" : ""}`} aria-hidden={mode !== "register"}>
          <label>
            {copy.common.confirmPassword}
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
                aria-label={showConfirmPassword ? copy.auth.hideConfirmPassword : copy.auth.showConfirmPassword}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
        </div>

        <button className="primary-action wide" type="submit" disabled={isBusy}>
          <LogIn size={18} />
          {mode === "login" ? copy.common.login : copy.common.register}
        </button>

        <p className="muted">{message}</p>
      </form>
    </main>
  );
}

function RouteMap({
  copy,
  mapDefinition,
  start,
  end,
  pickMode,
  onPick,
}: {
  copy: Translation;
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
        {copy.console.clickToSet} {pickMode === "start" ? copy.console.start : copy.console.finish}
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
