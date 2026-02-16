import 'package:flutter/material.dart';

class AutopilotView extends StatefulWidget {
  @override
  _AutopilotViewState createState() => _AutopilotViewState();
}

class _AutopilotViewState extends State<AutopilotView> {
  final TextEditingController _itemsController = TextEditingController();
  final TextEditingController _budgetController = TextEditingController();
  bool _isLoading = false;
  Map<String, dynamic>? _result;

  void _runAutopilot() async {
    setState(() { _isLoading = true; });

    // Simulate API call to FastAPI backend
    await Future.delayed(Duration(seconds: 2));

    setState(() {
      _isLoading = false;
      _result = {
        "strategy": "AI Optimize Sepet",
        "savings": "₺1,250.00",
        "items": _itemsController.text.split(',').map((e) => "${e.trim()} -> En ucuz: Amazon").toList()
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Otopilot Asistanı')),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _itemsController,
              decoration: InputDecoration(labelText: 'İhtiyaç Listesi (virgülle ayırın)'),
            ),
            TextField(
              controller: _budgetController,
              decoration: InputDecoration(labelText: 'Maksimum Bütçe (TL)'),
              keyboardType: TextInputType.number,
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isLoading ? null : _runAutopilot,
              child: _isLoading ? CircularProgressIndicator() : Text('STRATEJİ OLUŞTUR'),
            ),
            if (_result != null) ...[
              SizedBox(height: 20),
              Card(
                color: Colors.green.shade50,
                child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      Text('Strateji: ${_result!['strategy']}', style: TextStyle(fontWeight: FontWeight.bold)),
                      Text('Toplam Tasarruf: ${_result!['savings']}'),
                      ...(_result!['items'] as List).map((i) => Text(i)).toList()
                    ],
                  ),
                ),
              )
            ]
          ],
        ),
      ),
    );
  }
}
