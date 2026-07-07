class StoreModel {
  final String id;
  final String name;
  final String? address;
  final String? telegramChatId;
  final String? modelOverride;
  final DateTime? createdAt;

  StoreModel({
    required this.id,
    required this.name,
    this.address,
    this.telegramChatId,
    this.modelOverride,
    this.createdAt,
  });

  factory StoreModel.fromJson(Map<String, dynamic> j) => StoreModel(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        address: j['address'] as String?,
        telegramChatId: j['telegramChatId'] as String?,
        modelOverride: j['modelOverride'] as String?,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '')?.toLocal(),
      );
}

class CameraModel {
  final String id;
  final String storeId;
  final String name;
  final String? description;
  final String rtspUrl; // база без кредов
  final String? username;
  final bool hasPassword;
  final String? manufacturer;
  final String? model;
  final String? location;
  final bool enabled;
  final String status; // ONLINE | OFFLINE | UNKNOWN
  final int fpsLimit;
  final int? fps;
  final String? resolution;
  final DateTime? lastOnline;

  CameraModel({
    required this.id,
    required this.storeId,
    required this.name,
    required this.rtspUrl,
    required this.enabled,
    required this.status,
    required this.fpsLimit,
    required this.hasPassword,
    this.description,
    this.username,
    this.manufacturer,
    this.model,
    this.location,
    this.fps,
    this.resolution,
    this.lastOnline,
  });

  bool get isOnline => status == 'ONLINE';
  bool get isOffline => status == 'OFFLINE';

  factory CameraModel.fromJson(Map<String, dynamic> j) => CameraModel(
        id: j['id'] as String,
        storeId: j['storeId'] as String,
        name: j['name'] as String,
        description: j['description'] as String?,
        rtspUrl: j['rtspUrl'] as String? ?? '',
        username: j['username'] as String?,
        hasPassword: j['hasPassword'] as bool? ?? false,
        manufacturer: j['manufacturer'] as String?,
        model: j['model'] as String?,
        location: j['location'] as String?,
        enabled: j['enabled'] as bool? ?? true,
        status: j['status'] as String? ?? 'UNKNOWN',
        fpsLimit: j['fpsLimit'] as int? ?? 15,
        fps: j['fps'] as int?,
        resolution: j['resolution'] as String?,
        lastOnline: j['lastOnline'] != null
            ? DateTime.tryParse(j['lastOnline'] as String)?.toLocal()
            : null,
      );
}

class CameraTestResult {
  final bool online;
  final int? latency;
  final int? fps;
  final String? resolution;
  final String? error;

  CameraTestResult({
    required this.online,
    this.latency,
    this.fps,
    this.resolution,
    this.error,
  });

  factory CameraTestResult.fromJson(Map<String, dynamic> j) => CameraTestResult(
        online: j['online'] as bool? ?? false,
        latency: j['latency'] as int?,
        fps: j['fps'] as int?,
        resolution: j['resolution'] as String?,
        error: j['error'] as String?,
      );
}
