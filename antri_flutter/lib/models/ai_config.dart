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
    this.provider = 'gemini',
    this.model = 'gemini-3.7-flash',
    this.apiKey = '',
    this.baseUrl = '',
    this.mode = 'vibe',
    this.activeProfile = 'mobile_profile_1',
    this.alwaysAllow = false,
    this.firestoreProjectId = 'antri-agentic-hackathon',
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
        provider: json['provider'] ?? 'gemini',
        model: json['model'] ?? 'gemini-3.7-flash',
        apiKey: json['apiKey'] ?? '',
        baseUrl: json['baseUrl'] ?? '',
        mode: json['mode'] ?? 'vibe',
        activeProfile: json['activeProfile'] ?? 'mobile_profile_1',
        alwaysAllow: json['alwaysAllow'] ?? false,
        firestoreProjectId: (json['firestoreProjectId'] != null && (json['firestoreProjectId'] as String).isNotEmpty)
            ? json['firestoreProjectId']
            : 'antri-agentic-hackathon',
        syncKey: json['syncKey'] ?? '',
      );
}
