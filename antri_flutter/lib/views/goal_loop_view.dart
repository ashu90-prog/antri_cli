import 'package:flutter/material.dart';
import '../models/ai_config.dart';
import '../services/ai_service.dart';

class GoalLoopView extends StatefulWidget {
  final AIConfig config;
  final AIService aiService;

  const GoalLoopView({super.key, required this.config, required this.aiService});

  @override
  State<GoalLoopView> createState() => _GoalLoopViewState();
}

class _GoalLoopViewState extends State<GoalLoopView> {
  final TextEditingController _goalController = TextEditingController();
  String _stage1 = 'Ready';
  String _stage2 = 'Ready';
  String _stage3 = 'Ready';
  bool _isRunning = false;

  Future<void> _runGoalLoop() async {
    final objective = _goalController.text.trim();
    if (objective.isEmpty) return;

    setState(() {
      _isRunning = true;
      _stage1 = 'Executing Stage 1: Drafting plan and solution...';
      _stage2 = 'Standby...';
      _stage3 = 'Standby...';
    });

    try {
      // Stage 1: Formulation
      final s1 = await widget.aiService.executePrompt(
        config: widget.config,
        systemPrompt: 'You are Stage 1 of the Goal Loop. Formulate a comprehensive, complete solution draft.',
        userPrompt: 'Objective: $objective',
      );
      setState(() {
        _stage1 = s1;
        _stage2 = 'Executing Stage 2: Adversarial review & score...';
      });

      // Stage 2: Critique & Rating
      final s2 = await widget.aiService.executePrompt(
        config: widget.config,
        systemPrompt: 'You are Stage 2 of the Goal Loop. Critically review the draft for edge cases, performance, security, and assign a quality score (0-100%).',
        userPrompt: 'Draft Solution:\n$s1',
      );
      setState(() {
        _stage2 = s2;
        _stage3 = 'Executing Stage 3: Hardening solution into final delivery...';
      });

      // Stage 3: Hardened Output
      final s3 = await widget.aiService.executePrompt(
        config: widget.config,
        systemPrompt: 'You are Stage 3 of the Goal Loop. Synthesize the draft and critique into an optimal, production-ready, hardened solution.',
        userPrompt: 'Draft:\n$s1\n\nCritique:\n$s2',
      );
      setState(() {
        _stage3 = s3;
        _isRunning = false;
      });
    } catch (e) {
      setState(() {
        _stage3 = 'Goal Loop execution error: ${e.toString()}';
        _isRunning = false;
      });
    }
  }

  Widget _buildStageCard(String num, String title, String subtitle, String content) {
    const cardBg = Color(0xFFFFFFFF);
    const subtleBg = Color(0xFFF7F4EE);
    const textPrimary = Color(0xFF1C1917);
    const borderMain = Color(0xFFE6E0D4);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderMain),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              color: subtleBg,
              border: Border(bottom: BorderSide(color: borderMain)),
              borderRadius: BorderRadius.vertical(top: Radius.circular(9)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: textPrimary)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: cardBg, borderRadius: BorderRadius.circular(4), border: Border.all(color: borderMain)),
                  child: Text(num, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: textPrimary)),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(subtitle, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF8C827A))),
                const SizedBox(height: 8),
                SelectableText(
                  content,
                  style: const TextStyle(fontSize: 13, color: Color(0xFF57534E), height: 1.55),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const creamBg = Color(0xFFFCFBF9);
    const cardBg = Color(0xFFFFFFFF);
    const textPrimary = Color(0xFF1C1917);
    const borderMain = Color(0xFFE6E0D4);

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7F4EE),
        elevation: 0,
        title: const Text('Goal Loop Pipeline', style: TextStyle(fontWeight: FontWeight.w800, color: textPrimary, fontSize: 16)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderMain),
            ),
            child: Column(
              children: [
                TextField(
                  controller: _goalController,
                  decoration: const InputDecoration(
                    hintText: 'Enter goal / task to iteratively accomplish...',
                    border: InputBorder.none,
                    hintStyle: TextStyle(fontSize: 13, color: Color(0xFF8C827A)),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isRunning ? null : _runGoalLoop,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: textPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: Text(_isRunning ? 'Iterating...' : 'Execute Goal Loop', style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _buildStageCard('01', 'Stage 1: Formulation', 'Initial solution draft and code synthesis', _stage1),
          _buildStageCard('02', 'Stage 2: Adversarial Critique', 'Flaw detection, edge-case probing & rating', _stage2),
          _buildStageCard('03', 'Stage 3: Hardened Delivery', 'Production-ready output', _stage3),
        ],
      ),
    );
  }
}
