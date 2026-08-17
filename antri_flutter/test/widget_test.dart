import 'package:flutter_test/flutter_test.dart';
import 'package:antri_flutter/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('AntriFlutterApp smoke test', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const AntriFlutterApp());
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.byType(AntriFlutterApp), findsOneWidget);
  });
}
