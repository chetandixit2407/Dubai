import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  ExternalLink,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  RotateCcw,
  Smartphone,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Project, VirtualTourHotspot, VirtualTourRoom } from '../types/realEstate.ts';
import { getEffectiveTourStatus, TOUR_STATUS_LABELS } from '../utils/mediaValidation.ts';

interface VirtualTourModalProps {
  project: Project;
  onClose: () => void;
  onRequestPrivateTour?: (project: Project) => void;
  isPreview?: boolean;
}

const VERT_SHADER = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAG_SHADER = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_tex;
  uniform float u_yaw;
  uniform float u_pitch;
  uniform float u_fov;
  uniform float u_aspect;

  const float PI = 3.14159265359;

  void main() {
    float tanHalfFov = tan(radians(u_fov) * 0.5);
    vec3 dir = normalize(vec3(
      v_uv.x * u_aspect * tanHalfFov,
      v_uv.y * tanHalfFov,
      1.0
    ));

    // Pitch around X
    float cp = cos(u_pitch);
    float sp = sin(u_pitch);
    vec3 pitched = vec3(
      dir.x,
      dir.y * cp - dir.z * sp,
      dir.y * sp + dir.z * cp
    );

    // Yaw around Y
    float cy = cos(u_yaw);
    float sy = sin(u_yaw);
    vec3 world = vec3(
      pitched.x * cy + pitched.z * sy,
      pitched.y,
      -pitched.x * sy + pitched.z * cy
    );

    float lon = atan(world.x, world.z);
    float lat = asin(clamp(world.y, -1.0, 1.0));

    vec2 texUv = vec2(
      0.5 + lon / (2.0 * PI),
      0.5 - lat / PI
    );

    gl_FragColor = texture2D(u_tex, texUv);
  }
`;

function projectHotspotToViewport(
  hotspot: VirtualTourHotspot,
  camYawDeg: number,
  camPitchDeg: number,
  fovDeg: number,
  aspect: number
): { visible: boolean; xPct: number; yPct: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const hYaw = toRad(hotspot.yawDeg);
  const hPitch = toRad(hotspot.pitchDeg);

  // Unit vector on sphere in world coordinates
  const wx = Math.cos(hPitch) * Math.sin(hYaw);
  const wy = Math.sin(hPitch);
  const wz = Math.cos(hPitch) * Math.cos(hYaw);

  // Inverse yaw (-camYaw)
  const cy = Math.cos(-toRad(camYawDeg));
  const sy = Math.sin(-toRad(camYawDeg));
  const rx = wx * cy + wz * sy;
  const ry = wy;
  const rz = -wx * sy + wz * cy;

  // Inverse pitch (-camPitch)
  const cp = Math.cos(-toRad(camPitchDeg));
  const sp = Math.sin(-toRad(camPitchDeg));
  const cx = rx;
  const cy2 = ry * cp - rz * sp;
  const cz = ry * sp + rz * cp;

  if (cz <= 0.1) return { visible: false, xPct: 0, yPct: 0 };

  const tanHalfFov = Math.tan(toRad(fovDeg) * 0.5);
  const ndcX = cx / (cz * tanHalfFov * Math.max(0.5, aspect));
  const ndcY = cy2 / (cz * tanHalfFov);

  if (Math.abs(ndcX) > 1.05 || Math.abs(ndcY) > 1.05) {
    return { visible: false, xPct: 0, yPct: 0 };
  }

  return {
    visible: true,
    xPct: (ndcX * 0.5 + 0.5) * 100,
    yPct: (0.5 - ndcY * 0.5) * 100,
  };
}

export const VirtualTourModal: React.FC<VirtualTourModalProps> = ({
  project,
  onClose,
  onRequestPrivateTour,
  isPreview = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const effectiveStatus = getEffectiveTourStatus(project);
  const trueRooms = useMemo<VirtualTourRoom[]>(
    () =>
      (project.virtualTour.rooms || []).filter(
        (r) => r.isTrue360Panorama && r.projectId === project.id && Boolean(r.imageUrl)
      ),
    [project]
  );

  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(() => trueRooms[0]?.id || '');

  const filteredRooms = useMemo(() => {
    return trueRooms.filter((r) => {
      if (floorFilter !== 'all' && r.floorLevel !== floorFilter) return false;
      if (categoryFilter !== 'all' && r.viewCategory !== categoryFilter) return false;
      return true;
    });
  }, [trueRooms, floorFilter, categoryFilter]);

  const activeRoom =
    filteredRooms.find((r) => r.id === selectedRoomId) || filteredRooms[0] || trueRooms[0];

  const floors = useMemo(
    () => Array.from(new Set(trueRooms.map((r) => r.floorLevel).filter(Boolean))),
    [trueRooms]
  );

  const [yawDeg, setYawDeg] = useState<number>(activeRoom?.yawOffset || 0);
  const [pitchDeg, setPitchDeg] = useState<number>(0);
  const [fovDeg, setFovDeg] = useState<number>(75);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFloorPlans, setShowFloorPlans] = useState(
    effectiveStatus === 'coming_soon' && project.floorPlans.length > 0
  );
  const [activeHotspot, setActiveHotspot] = useState<VirtualTourHotspot | null>(null);
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string>(
    project.floorPlans[0]?.id || ''
  );

  const tourList = useMemo(() => project.virtualTour.tours || [], [project.virtualTour.tours]);
  const [selectedTourIdx, setSelectedTourIdx] = useState(0);
  const activeTourItem = tourList[selectedTourIdx] || null;
  const isEmbedRestricted = activeTourItem
    ? activeTourItem.embedAvailable === false
    : project.virtualTour.embedAvailable === false;
  const activeTourUrl =
    activeTourItem?.embedUrl ||
    activeTourItem?.directUrl ||
    project.virtualTour.embedUrl ||
    project.virtualTour.directUrl ||
    project.virtualTour.webXrUrl;

  // Drag / Pointer / Gyroscope states
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroSupported] = useState<boolean>(
    () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  );
  const [webglFallbackActive, setWebglFallbackActive] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1.77);

  // Track room changes
  useEffect(() => {
    if (activeRoom) {
      setYawDeg(activeRoom.yawOffset || 0);
      setPitchDeg(0);
      setActiveHotspot(null);
      if (activeRoom.floorPlanId) {
        setSelectedFloorPlanId(activeRoom.floorPlanId);
      }
    }
  }, [activeRoom?.id]);

  // Listen to native fullscreen state changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  // WebGL 360 Equirectangular Renderer
  const glStateRef = useRef<{
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    texture: WebGLTexture;
    uYaw: WebGLUniformLocation | null;
    uPitch: WebGLUniformLocation | null;
    uFov: WebGLUniformLocation | null;
    uAspect: WebGLUniformLocation | null;
    ready: boolean;
  } | null>(null);

  useEffect(() => {
    if (effectiveStatus !== '360_available' || !activeRoom?.imageUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setWebglFallbackActive(false);

    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
    if (!gl) {
      setWebglFallbackActive(true);
      return;
    }

    const compileShader = (type: number, source: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERT_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAG_SHADER);
    if (!vs || !fs) {
      setWebglFallbackActive(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebglFallbackActive(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setWebglFallbackActive(true);
      return;
    }
    gl.useProgram(program);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    if (!texture) {
      setWebglFallbackActive(true);
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    glStateRef.current = {
      gl,
      program,
      texture,
      uYaw: gl.getUniformLocation(program, 'u_yaw'),
      uPitch: gl.getUniformLocation(program, 'u_pitch'),
      uFov: gl.getUniformLocation(program, 'u_fov'),
      uAspect: gl.getUniformLocation(program, 'u_aspect'),
      ready: false,
    };

    let cancelled = false;
    const img = new Image();
    if (!activeRoom.imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (cancelled || !glStateRef.current) return;
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        glStateRef.current.ready = true;
        // Trigger draw
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        const asp = canvas.width / Math.max(1, canvas.height);
        setAspectRatio(asp);
        gl.uniform1f(glStateRef.current.uYaw, (yawDeg * Math.PI) / 180);
        gl.uniform1f(glStateRef.current.uPitch, (pitchDeg * Math.PI) / 180);
        gl.uniform1f(glStateRef.current.uFov, fovDeg);
        gl.uniform1f(glStateRef.current.uAspect, asp);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } catch {
        setWebglFallbackActive(true);
      }
    };
    img.onerror = () => {
      if (!cancelled) setWebglFallbackActive(true);
    };
    img.src = activeRoom.imageUrl;

    return () => {
      cancelled = true;
      glStateRef.current = null;
    };
  }, [effectiveStatus, activeRoom?.id, activeRoom?.imageUrl]);

  // Redraw WebGL on camera movement or resize
  useEffect(() => {
    if (effectiveStatus !== '360_available' || webglFallbackActive) return;
    const draw = () => {
      const canvas = canvasRef.current;
      const state = glStateRef.current;
      if (!canvas || !state || !state.ready) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const asp = canvas.width / Math.max(1, canvas.height);
      setAspectRatio(asp);
      state.gl.viewport(0, 0, canvas.width, canvas.height);
      state.gl.uniform1f(state.uYaw, (yawDeg * Math.PI) / 180);
      state.gl.uniform1f(state.uPitch, (pitchDeg * Math.PI) / 180);
      state.gl.uniform1f(state.uFov, fovDeg);
      state.gl.uniform1f(state.uAspect, asp);
      state.gl.drawArrays(state.gl.TRIANGLE_STRIP, 0, 4);
    };

    const raf = requestAnimationFrame(draw);
    window.addEventListener('resize', draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', draw);
    };
  }, [yawDeg, pitchDeg, fovDeg, isFullscreen, showFloorPlans, webglFallbackActive, effectiveStatus]);

  // Gyroscope orientation listener
  useEffect(() => {
    if (!gyroEnabled) return;
    let initialAlpha: number | null = null;
    const handleOrientation = (ev: DeviceOrientationEvent) => {
      if (ev.alpha === null || ev.beta === null) return;
      if (initialAlpha === null) initialAlpha = ev.alpha;
      const deltaYaw = initialAlpha - ev.alpha;
      const clampedPitch = Math.max(-75, Math.min(75, ev.beta - 65));
      setYawDeg(((deltaYaw % 360) + 360) % 360);
      setPitchDeg(clampedPitch);
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [gyroEnabled]);

  const handleEnableGyro = async () => {
    if (gyroEnabled) {
      setGyroEnabled(false);
      return;
    }
    try {
      const DeviceOrientationEvt = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof DeviceOrientationEvt?.requestPermission === 'function') {
        const res = await DeviceOrientationEvt.requestPermission();
        if (res !== 'granted') return;
      }
      setGyroEnabled(true);
    } catch {
      setGyroEnabled(false);
    }
  };

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY, yaw: yawDeg, pitch: pitchDeg };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragOrigin.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    const sensitivity = fovDeg / 450;
    const nextYaw = (((dragOrigin.current.yaw - dx * sensitivity) % 360) + 360) % 360;
    const nextPitch = Math.max(-80, Math.min(80, dragOrigin.current.pitch + dy * sensitivity));
    setYawDeg(nextYaw);
    setPitchDeg(nextPitch);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    dragOrigin.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setFovDeg((prev) => Math.max(35, Math.min(105, prev + (e.deltaY > 0 ? 5 : -5))));
  };

  const handleSelectFloorPlan = (fpId: string) => {
    setSelectedFloorPlanId(fpId);
    const matchingRoom = trueRooms.find((r) => r.floorPlanId === fpId);
    if (matchingRoom) {
      setFloorFilter('all');
      setCategoryFilter('all');
      setSelectedRoomId(matchingRoom.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-0 md:p-4">
      <div
        ref={containerRef}
        className={`bg-[#080808] text-white flex flex-col border border-[#D4AF72]/20 ${
          isFullscreen ? 'w-full h-full' : 'w-full max-w-7xl h-[94vh] md:h-[88vh]'
        }`}
      >
        {/* Top Interactive Control Header */}
        <div className="px-5 py-3.5 border-b border-[#D4AF72]/20 flex flex-wrap items-center justify-between gap-3 bg-[#121212] shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#D4AF72] uppercase tracking-wider font-semibold">
              <span>{TOUR_STATUS_LABELS[effectiveStatus]}</span>
              {isPreview && <span className="px-1.5 py-0.5 bg-[#D4AF72] text-[#080808]">ADMIN PREVIEW</span>}
              {project.virtualTour.provider && <span>· {project.virtualTour.provider}</span>}
              <span>
                · {project.community}, {project.emirate}
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold truncate mt-0.5">
              {project.name}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {effectiveStatus === '360_available' && (
              <>
                <button
                  type="button"
                  onClick={() => setFovDeg((p) => Math.max(35, p - 10))}
                  title="Zoom In"
                  className="h-9 w-9 border border-white/20 flex items-center justify-center hover:border-[#D4AF72]"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFovDeg((p) => Math.min(105, p + 10))}
                  title="Zoom Out"
                  className="h-9 w-9 border border-white/20 flex items-center justify-center hover:border-[#D4AF72]"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setYawDeg(activeRoom?.yawOffset || 0);
                    setPitchDeg(0);
                    setFovDeg(75);
                  }}
                  title="Reset View"
                  className="h-9 w-9 border border-white/20 flex items-center justify-center hover:border-[#D4AF72]"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                {gyroSupported && (
                  <button
                    type="button"
                    onClick={handleEnableGyro}
                    className={`h-9 px-3 border text-xs font-medium flex items-center gap-1.5 ${
                      gyroEnabled
                        ? 'bg-[#D4AF72] border-[#D4AF72] text-white'
                        : 'border-white/20 hover:border-[#D4AF72]'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{gyroEnabled ? 'Gyro On' : 'Gyroscope'}</span>
                  </button>
                )}
              </>
            )}

            {project.floorPlans.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFloorPlans((p) => !p)}
                className={`h-9 px-3 border text-xs font-medium flex items-center gap-1.5 ${
                  showFloorPlans
                    ? 'bg-[#D4AF72] border-[#D4AF72] text-white'
                    : 'border-white/20 hover:border-[#D4AF72]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Floor Plans ({project.floorPlans.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="h-9 px-3 border border-white/20 text-xs font-medium hover:border-[#D4AF72] flex items-center gap-1.5"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Virtual Tour"
              className="w-9 h-9 border border-white/20 flex items-center justify-center hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-Tour Gallery Bar */}
        {tourList.length > 1 && (
          <div className="px-5 py-2.5 bg-black/90 border-b border-[#D4AF72]/20 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
            <span className="text-[#D4AF72] font-semibold whitespace-nowrap">
              Available 360° Tours ({tourList.length}):
            </span>
            {tourList.map((t, idx) => (
              <button
                key={t.id || idx}
                type="button"
                onClick={() => setSelectedTourIdx(idx)}
                className={`px-3 py-1 font-medium whitespace-nowrap transition-colors ${
                  selectedTourIdx === idx
                    ? 'bg-[#D4AF72] text-[#080808]'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>
        )}

        {/* Main Viewport Split */}
        <div className="flex-1 relative overflow-hidden bg-black flex flex-col md:flex-row min-h-0">
          {/* 1. TOUR NOT AVAILABLE (STRICT NO FAKE TOURS) */}
          {effectiveStatus === 'coming_soon' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#121212] to-[#080808]">
              <Compass className="w-12 h-12 text-[#D4AF72] mb-4" />
              <p className="text-xs uppercase tracking-[0.2em] text-[#D4AF72] font-semibold mb-2">
                Authentic Property Media Policy · Verified Tours Only
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-semibold max-w-2xl text-white">
                Media Not Available
              </h3>
              <p className="text-sm text-white/75 max-w-xl leading-relaxed mt-3">
                A verified 360° panorama, Matterport 3D digital twin, or developer walkthrough video has not yet been indexed specifically for{' '}
                <strong className="text-white">{project.name}</strong>. Static architectural renders or ordinary photos are never disguised as 360° tours. Schedule a private guided virtual tour or developer presentation directly with our advisory desk.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                {onRequestPrivateTour && !isPreview && (
                  <button
                    type="button"
                    onClick={() => onRequestPrivateTour(project)}
                    className="px-6 py-3 bg-[#D4AF72] text-[#080808] text-xs sm:text-sm font-semibold hover:bg-[#E6C77A] flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    <span>Request a Private Virtual Tour</span>
                  </button>
                )}
                {project.floorPlans.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFloorPlans((p) => !p)}
                    className="px-5 py-3 border border-white/25 text-white text-xs sm:text-sm font-medium hover:border-[#D4AF72] flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-[#D4AF72]" />
                    <span>{showFloorPlans ? 'Hide Floor Plans' : 'Inspect Unit Floor Plans'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2. AUTHORIZED MATTERPORT / 3D / WEBXR / SPATIAL MODEL */}
          {effectiveStatus === '3d_available' && (
            isEmbedRestricted ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#121212] to-[#080808]">
                <div className="max-w-xl p-8 border border-white/20 bg-white/5 space-y-4">
                  <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-[#D4AF72]">
                    <Compass className="w-4 h-4" />
                    <span>Verified Official Developer 3D Experience</span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-semibold text-white">
                    {activeTourItem?.title || `${project.name} Interactive 3D Model`}
                  </h3>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Hosted on {activeTourItem?.provider || project.virtualTour.provider || 'official developer'} interactive spatial platform.
                    In accordance with provider security policies (CSP frame-ancestors / X-Frame-Options), this tour is designed to launch in a full-screen dedicated window for maximum responsiveness and high-resolution rendering.
                  </p>
                  <div className="pt-2">
                    <a
                      href={activeTourUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#D4AF72] text-[#080808] text-xs sm:text-sm font-semibold hover:bg-[#E6C77A] transition-colors"
                    >
                      <span>Launch Official 360° Tour in Dedicated Window</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <div className="mt-4 text-xs text-white/60 font-mono-tabular">
                  Source: {activeTourItem?.sourceName || project.virtualTour.sourceName || project.developerName}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <iframe
                  src={activeTourUrl}
                  title={`${project.name} Official 3D Virtual Tour`}
                  className="w-full flex-1 border-0 bg-black"
                  allow="xr-spatial-tracking; fullscreen; gyroscope; accelerometer"
                  allowFullScreen
                />
                <div className="px-5 py-2.5 bg-[#121212] border-t border-[#D4AF72]/20 flex flex-wrap items-center justify-between gap-3 text-xs text-white/80">
                  <span>
                    Source: {activeTourItem?.sourceName || project.virtualTour.sourceName || project.virtualTour.provider || 'Authorized Developer 3D Twin'}
                  </span>
                  <div className="flex items-center gap-4">
                    {activeTourUrl && (
                      <a
                        href={activeTourUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D4AF72] hover:underline flex items-center gap-1"
                      >
                        <span>Open Full Tour URL</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          )}

          {/* 3. PRIORITIZED PROJECT WALKTHROUGH / PROPERTY VIDEO */}
          {effectiveStatus === 'video_available' &&
            (project.primaryVideo?.embedUrl ||
              project.virtualTour.walkthroughVideoUrl ||
              project.walkthroughVideoUrl) && (() => {
              const modalVideo = project.primaryVideo || project.videoItems?.[0];
              const videoUrl =
                modalVideo?.embedUrl ||
                project.virtualTour.walkthroughVideoUrl ||
                project.walkthroughVideoUrl ||
                '';
              const isDirectMediaFile = /\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl);

              return (
                <div className="flex-1 flex flex-col min-h-0 bg-black">
                  {isDirectMediaFile ? (
                    <video
                      src={videoUrl}
                      controls
                      playsInline
                      className="w-full flex-1 object-contain bg-black"
                    />
                  ) : (
                    <iframe
                      src={videoUrl}
                      title={modalVideo?.title || `${project.name} Video Walkthrough`}
                      className="w-full flex-1 border-0 bg-black"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  )}
                  <div className="px-5 py-3 bg-[#121212] border-t border-[#D4AF72]/20 flex flex-wrap items-center justify-between gap-3 text-xs text-white/85">
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">
                        {modalVideo?.title || `${project.name} Verified Video`}
                      </p>
                      <p className="text-[11px] text-white/70 mt-0.5">
                        Channel: {modalVideo?.channelName || project.developerName}
                        {modalVideo?.publishedAt ? ` · Uploaded ${modalVideo.publishedAt}` : ''}
                        {modalVideo?.priorityLabel ? ` · ${modalVideo.priorityLabel}` : ''}
                      </p>
                    </div>
                    {modalVideo?.sourceUrl && (
                      <a
                        href={modalVideo.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D4AF72] hover:underline flex items-center gap-1 shrink-0 font-semibold"
                      >
                        <span>Original Source</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* 4. TRUE INTERACTIVE 360° EQUIRECTANGULAR PANORAMA VIEWER */}
          {effectiveStatus === '360_available' && activeRoom && (
            <div
              ref={stageRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              className={`flex-1 relative overflow-hidden select-none touch-none ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {webglFallbackActive ? (
                <img
                  src={activeRoom.imageUrl}
                  alt={activeRoom.label}
                  draggable={false}
                  style={{
                    objectPosition: `${(yawDeg / 360) * 100}% ${50 + pitchDeg * 0.45}%`,
                    transform: `scale(${Math.max(1.05, 95 / fovDeg)})`,
                  }}
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <canvas ref={canvasRef} className="w-full h-full block" />
              )}

              {/* Subtle Top Controls HUD (Floor & View Category Selectors) */}
              <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
                  {floors.length > 1 && (
                    <select
                      value={floorFilter}
                      onChange={(e) => setFloorFilter(e.target.value)}
                      aria-label="Filter by floor level"
                      className="h-8 px-2.5 bg-black/75 border border-white/25 text-xs text-white focus:outline-none focus:border-[#D4AF72]"
                    >
                      <option value="all">All Floors ({floors.length})</option>
                      {floors.map((fl) => (
                        <option key={fl} value={fl}>
                          {fl}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filter by view type"
                    className="h-8 px-2.5 bg-black/75 border border-white/25 text-xs text-white focus:outline-none focus:border-[#D4AF72]"
                  >
                    <option value="all">All Tour Areas</option>
                    <option value="interior">Interiors</option>
                    <option value="exterior">Exteriors</option>
                    <option value="amenities">Amenities & Facilities</option>
                    <option value="villa_apartment">Villa / Apartment</option>
                  </select>
                </div>

                <div className="bg-black/75 border border-white/20 px-3 py-1.5 text-[11px] font-mono-tabular flex items-center gap-2">
                  <Move className="w-3.5 h-3.5 text-[#D4AF72]" />
                  <span>
                    Drag to Look · Yaw {Math.round(yawDeg)}° · FOV {fovDeg}°
                  </span>
                </div>
              </div>

              {/* Interactive Spherical Hotspots */}
              {(activeRoom.hotspots || []).map((hs) => {
                const pos = projectHotspotToViewport(hs, yawDeg, pitchDeg, fovDeg, aspectRatio);
                if (!pos.visible) return null;
                return (
                  <button
                    key={hs.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hs.targetRoomId) {
                        const target = trueRooms.find((r) => r.id === hs.targetRoomId);
                        if (target) {
                          setFloorFilter('all');
                          setCategoryFilter('all');
                          setSelectedRoomId(target.id);
                          return;
                        }
                      }
                      setActiveHotspot((curr) => (curr?.id === hs.id ? null : hs));
                    }}
                    style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#121212]/90 border border-[#D4AF72] text-white text-xs font-medium hover:bg-[#D4AF72] shadow-lg transition-colors flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 bg-[#E6C77A] inline-block" />
                    <span>{hs.label}</span>
                  </button>
                );
              })}

              {/* Hotspot Info Overlay */}
              {activeHotspot && (
                <div className="absolute top-16 left-4 bg-[#121212]/95 border border-[#D4AF72] p-4 max-w-xs text-xs shadow-xl">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-[#D4AF72]">{activeHotspot.label}</p>
                    <button
                      type="button"
                      onClick={() => setActiveHotspot(null)}
                      className="text-white/70 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {activeHotspot.detail && (
                    <p className="text-white/85 mt-1 leading-relaxed">{activeHotspot.detail}</p>
                  )}
                </div>
              )}

              {/* Bottom Room Details Overlay */}
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3 pointer-events-none">
                <div className="bg-black/80 border border-[#D4AF72]/20 p-3.5 max-w-md pointer-events-auto">
                  <p className="text-[11px] text-[#D4AF72] font-semibold uppercase tracking-wider">
                    {activeRoom.floorLevel || 'Main Level'} · {activeRoom.viewCategory.replace('_', ' / ')}
                  </p>
                  <h4 className="font-display text-lg sm:text-xl font-semibold mt-0.5">
                    {activeRoom.label}
                  </h4>
                  {activeRoom.description && (
                    <p className="text-xs text-white/80 mt-1">{activeRoom.description}</p>
                  )}
                  <p className="text-[11px] text-white/60 mt-1.5">
                    Source: {activeRoom.sourceName}
                  </p>
                </div>

                {project.virtualTour.webXrUrl && (
                  <a
                    href={project.virtualTour.webXrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointer-events-auto px-3.5 py-2 bg-[#121212]/90 border border-[#D4AF72] text-xs font-medium text-[#D4AF72] hover:bg-[#D4AF72] hover:text-white flex items-center gap-1.5"
                  >
                    <span>Open WebXR Experience</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Interactive Floor Plan Side Drawer */}
          {showFloorPlans && project.floorPlans.length > 0 && (
            <aside className="w-full md:w-80 bg-[#1B1B1B] border-t md:border-t-0 md:border-l border-[#D4AF72]/20 p-4 overflow-y-auto shrink-0">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] mb-1">
                Interactive Floor Plan Explorer
              </h4>
              <p className="text-[11px] text-white/65 mb-3">
                Select a layout to inspect dimensions or jump to its connected 360° panorama.
              </p>
              <div className="space-y-2.5">
                {project.floorPlans.map((fp) => {
                  const linkedRoom = trueRooms.find((r) => r.floorPlanId === fp.id);
                  const isSelected = selectedFloorPlanId === fp.id;
                  return (
                    <button
                      key={fp.id}
                      type="button"
                      onClick={() => handleSelectFloorPlan(fp.id)}
                      className={`w-full text-left border p-3 transition-colors ${
                        isSelected
                          ? 'border-[#D4AF72] bg-[#1F1B15]'
                          : 'border-[#D4AF72]/20 bg-white/5 hover:border-white/35'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{fp.name}</p>
                        {linkedRoom && (
                          <span className="text-[10px] font-semibold text-[#D4AF72]">
                            360° Linked
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/70 mt-0.5">
                        {fp.bedrooms} · {fp.floorRange} · {fp.exposure}
                      </p>
                      <div className="flex items-center justify-between text-xs font-mono-tabular mt-2 pt-2 border-t border-white/10">
                        <span>{fp.sizeSqFt.toLocaleString()} sq.ft</span>
                        <span className="text-[#D4AF72]">AED {fp.priceAed.toLocaleString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}
        </div>

        {/* Room-to-Room & Floor-to-Floor Switcher Footer */}
        {effectiveStatus === '360_available' && filteredRooms.length > 0 && (
          <div className="px-5 py-3 border-t border-[#D4AF72]/20 bg-[#121212] flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-white/60 mr-1 shrink-0">
              Scenes ({filteredRooms.length}):
            </span>
            {filteredRooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setSelectedRoomId(room.id)}
                className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border ${
                  activeRoom?.id === room.id
                    ? 'bg-[#D4AF72] border-[#D4AF72] text-white'
                    : 'bg-white/5 border-[#D4AF72]/20 text-white/80 hover:bg-white/15'
                }`}
              >
                {room.floorLevel ? `${room.floorLevel} · ` : ''}
                {room.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
