class ChatMessage {
  final String role; // 'user' or 'assistant'
  final String content;
  final List<String> attachmentNames;
  final List<String> attachmentPaths;
  final DateTime timestamp;

  ChatMessage({
    required this.role,
    required this.content,
    this.attachmentNames = const [],
    this.attachmentPaths = const [],
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'role': role,
        'content': content,
        'attachmentNames': attachmentNames,
        'attachmentPaths': attachmentPaths,
        'timestamp': timestamp.toIso8601String(),
      };

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        role: json['role'] ?? 'user',
        content: json['content'] ?? '',
        attachmentNames: List<String>.from(json['attachmentNames'] ?? []),
        attachmentPaths: List<String>.from(json['attachmentPaths'] ?? []),
        timestamp: DateTime.tryParse(json['timestamp'] ?? '') ?? DateTime.now(),
      );
}
