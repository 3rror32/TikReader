"""Compose TikReader services without coupling their implementation to server.py."""
from animation_studio import AnimationStudio
from chatbot import Chatbot
from core_routes import register_core_routes
from creator_suite import CreatorSuite
from emoji_overlay import EmojiOverlay
from game_hotkeys import GameHotkeys
from interactivity import Interactivity
from live_counters import LiveCounters
from live_tools import LiveTools
from local_tts import LocalTTS
from microphone_captions import MicrophoneCaptions
from minecraft_connector import MinecraftConnector
from obs_direct import OBSDirect
from operator_tools import OperatorTools
from overlay_animations import OverlayAnimations
from platform_connectors import PlatformManager
from points_system import PointsSystem
from production import Production
from release_support import register_release_routes
from reliability import Reliability
from seasonal_overlay import SeasonalOverlay
from simulation import Simulation
from spotify_integration import Spotify
from stream_buddies import StreamBuddies
from system_routes import register_system_routes
from user_info_overlay import UserInfoOverlay
from voice_downloads import VoiceDownloads
from voice_models import VoiceModels


def register_runtime_services(app, runtime, project_root, config, metrics):
    """Create services in dependency order and expose them on the runtime module."""
    def add(name, factory, *args):
        service = factory(app, *args)
        setattr(runtime, name, service)
        return service

    add("production", Production, runtime)
    add("microphone_captions", MicrophoneCaptions, runtime)
    add("points", PointsSystem, runtime)
    add("live_counters", LiveCounters, runtime)
    add("minecraft", MinecraftConnector, runtime)
    add("interactive", Interactivity, runtime)
    add("obs_direct", OBSDirect, runtime)
    add("chatbot", Chatbot, runtime)
    add("game_hotkeys", GameHotkeys, runtime)
    add("animation_studio", AnimationStudio, runtime)
    add("overlay_animations", OverlayAnimations, runtime)
    add("user_info_overlay", UserInfoOverlay, runtime)
    add("emoji_overlay", EmojiOverlay, runtime)
    add("seasonal", SeasonalOverlay, runtime)
    add("stream_buddies", StreamBuddies, runtime)
    add("spotify", Spotify, runtime)
    add("operator_tools", OperatorTools, runtime)
    add("live_tools", LiveTools, runtime)
    add("reliability", Reliability, runtime)
    add("voice_models", VoiceModels, project_root)
    add("local_tts", LocalTTS, project_root)

    runtime.voice_downloads = VoiceDownloads(app, runtime)
    runtime.simulation = Simulation(app, runtime)
    runtime.creator_suite = CreatorSuite(app, runtime)
    runtime.platform_manager = PlatformManager(runtime)

    register_release_routes(app, runtime)
    register_system_routes(app, runtime, config, metrics)
    register_core_routes(app, runtime, project_root)
    return runtime
