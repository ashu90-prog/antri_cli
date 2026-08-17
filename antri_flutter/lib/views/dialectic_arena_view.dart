import 'package:flutter/material.dart';
import '../models/ai_config.dart';
import '../services/ai_service.dart';

class DialecticArenaView extends StatefulWidget {
  final AIConfig config;
  final AIService aiService;

  const DialecticArenaView({super.key, required this.config, required this.aiService});

  @override
  State<DialecticArenaView> createState() => _DialecticArenaViewState();
}

class _DialecticArenaViewState extends State<DialecticArenaView> {
  final TextEditingController _queryController = TextEditingController();
  String _thesis = 'Awaiting debate initiation...';
  String _antithesis = 'Awaiting thesis generation...';
  String _verification = 'Verification engine standby...';
  String _synthesis = 'Consensus will appear here...';
  bool _isDebating = false;

  Future<void> _runDebate() async {
    final query = _queryController.text.trim();
    if (query.isEmpty) return;

    setState(() {
      _isDebating = true;
      _thesis = 'Formulating initial thesis and solution...';
      _antithesis = 'Adversary standby...';
      _verification = 'Researcher standby...';
      _synthesis = 'Judge standby...';
    });

    try {
      // Stage 1: Thesis
      final t = await widget.aiService.executePrompt(
        config: widget.config,
        systemPrompt: 'You are The Proposer in a Dialectic debate. Formulate a strong, innovative architecture thesis/solution.',
        userPrompt: 'Debate Question: $query',
      );
      setState(() => _thesis = t);

      // Stage 2: Antithesis
      setState(() => _antithesis = 'Critiquing edge cases and flaws...');
      final a = await widget.aiService.executePrompt(
        config: widget.config,
        systemPrompt: 'You are The Adversary in a Dialectic debate. Challenge the thesis, find bugs, security holes, and flaws.',
        userPrompt: 'Thesis to critique:\n$t',
      );
      setState(() => _antithesis = a);

      // Stage 3: Verification
      setState(() => _verification = 'Verifying claims and benchmarks...');
      final v = await widget.aiService.executePrompt(
        config: widget.config,
        systemPrompt: 'You are The Researcher in a Dialectic debate. Fact-check disputed claims between Thesis and Antithesis.',
        userPrompt: 'Thesis:\n$t\n\nAntithesis:\n$a',
      );
      setState(() => _verification = v);

      // Stage 4: Synthesis
      setState(() => _synthesis = 'Synthesizing final consensus...');
      final s = await widget.aiService.executePrompt(
        config: widget.config,
        systemPrompt: 'You are The Judge in a Dialectic debate. Reconcile contradictions and output a robust, hardened synthesis.',
        userPrompt: 'Thesis:\n$t\n\nAntithesis:\n$a\n\nVerification:\n$v',
      );
      setState(() {
        _synthesis = s;
        _isDebating = false;
      });
    } catch (e) {
      setState(() {
        _synthesis = 'Debate error: ${e.toString()}';
        _isDebating = false;
      });
    }
  }

  Widget _buildPersonaCard(String title, String tag, String content) {
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
                Text(tag, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF8C827A))),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: SelectableText(
              content,
              style: const TextStyle(fontSize: 13, color: Color(0xFF57534E), height: 1.55),
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
        title: const Text('Dialectic Arena', style: TextStyle(fontWeight: FontWeight.w800, color: textPrimary, fontSize: 16)),
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
                  controller: _queryController,
                  decoration: const InputDecoration(
                    hintText: 'Enter architecture trade-off or problem to debate...',
                    border: InputBorder.none,
                    hintStyle: TextStyle(fontSize: 13, color: Color(0xFF8C827A)),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isDebating ? null : _runDebate,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: textPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: Text(_isDebating ? 'Debating...' : 'Launch Self-Debate', style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _buildPersonaCard('The Proposer', 'Thesis Formulation', _thesis),
          _buildPersonaCard('The Adversary', 'Critique & Flaws', _antithesis),
          _buildPersonaCard('The Researcher', 'Verification', _verification),
          _buildPersonaCard('The Judge', 'Consensus Synthesis', _synthesis),
        ],
      ),
    );
  }
}
