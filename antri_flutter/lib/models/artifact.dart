class Artifact {
  final String id;
  final String sessionId;
  final String sessionTitle;
  final String title;
  final String type; // 'html' | 'graph' | 'mindmap'
  final String content;
  final DateTime createdAt;

  Artifact({
    required this.id,
    required this.sessionId,
    required this.sessionTitle,
    required this.title,
    required this.type,
    required this.content,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'id': id,
        'sessionId': sessionId,
        'sessionTitle': sessionTitle,
        'title': title,
        'type': type,
        'content': content,
        'createdAt': createdAt.toIso8601String(),
      };

  factory Artifact.fromJson(Map<String, dynamic> json) => Artifact(
        id: json['id'] ?? 'art_${DateTime.now().millisecondsSinceEpoch}',
        sessionId: json['sessionId'] ?? 'default',
        sessionTitle: json['sessionTitle'] ?? 'General Chat',
        title: json['title'] ?? 'Interactive Artifact',
        type: json['type'] ?? 'html',
        content: json['content'] ?? '',
        createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
      );
}
