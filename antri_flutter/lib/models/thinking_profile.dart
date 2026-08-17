class ThinkingProfile {
  final String name;
  String content;
  DateTime updatedAt;

  ThinkingProfile({
    required this.name,
    required this.content,
    DateTime? updatedAt,
  }) : updatedAt = updatedAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'name': name,
        'content': content,
        'updatedAt': updatedAt.toIso8601String(),
      };

  factory ThinkingProfile.fromJson(Map<String, dynamic> json) => ThinkingProfile(
        name: json['name'] ?? 'profile_1',
        content: json['content'] ?? '# Profile Instructions\n\n- Preferred Language: TypeScript',
        updatedAt: DateTime.tryParse(json['updatedAt'] ?? '') ?? DateTime.now(),
      );
}
