class MobileRateLimiter {
  static final Map<String, int> _lastRequestTimes = {};
  static final Map<String, int> _requestCounts = {};

  static const int maxPerMinute = 25;

  static bool checkLimit(String actionKey) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final lastTime = _lastRequestTimes[actionKey] ?? 0;
    final count = _requestCounts[actionKey] ?? 0;

    if (now - lastTime > 60000) {
      _lastRequestTimes[actionKey] = now;
      _requestCounts[actionKey] = 1;
      return true;
    }

    if (count >= maxPerMinute) {
      return false;
    }

    _requestCounts[actionKey] = count + 1;
    return true;
  }
}
