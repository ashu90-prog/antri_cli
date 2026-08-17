class AIConfig {
  String provider;
  String model;
  String apiKey;
  String baseUrl;
  String mode; // 'vibe' or 'plan'
  String activeProfile;
  bool alwaysAllow;
  String firestoreProjectId;
  String syncKey;

  AIConfig({
    this.provider = 'deepseek',
    this.model = 'deepseek-chat',
    this.apiKey = '',
    this.baseUrl = '',
    this.mode = 'vibe',
    this.activeProfile = 'mobile_profile_1',
    this.alwaysAllow = false,
    this.firestoreProjectId = '',
    this.syncKey = '',
  });

  Map<String, dynamic> toJson() => {
        'provider': provider,
        'model': model,
        'apiKey': apiKey,
        'baseUrl': baseUrl,
        'mode': mode,
        'activeProfile': activeProfile,
        'alwaysAllow': alwaysAllow,
        'firestoreProjectId': firestoreProjectId,
        'syncKey': syncKey,
      };

  factory AIConfig.fromJson(Map<String, dynamic> json) => AIConfig(
        provider: json['provider'] ?? 'deepseek',
        model: json['model'] ?? 'deepseek-chat',
        apiKey: json['apiKey'] ?? '',
        baseUrl: json['baseUrl'] ?? '',
        mode: json['mode'] ?? 'vibe',
        activeProfile: json['activeProfile'] ?? 'mobile_profile_1',
        alwaysAllow: json['alwaysAllow'] ?? false,
        firestoreProjectId: json['firestoreProjectId'] ?? '',
        syncKey: json['syncKey'] ?? '',
      );
}
