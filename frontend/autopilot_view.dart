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
        "strategy": "Kombine Güvenli Alışveriş",
        "savings": "₺1,250.00",
        "savings_percentage": "12%",
        "ai_note": "Analiz tamamlandı. En yüksek satıcı puanlı mağazalar seçildi.",
        "items": _itemsController.text.split(',').map((e) => {
          "name": e.trim(),
          "store": "Amazon",
          "price": "₺4,500.00",
          "delivery": "2 Gün"
        }).toList()
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
              SizedBox(height: 24),
              Container(
                padding: EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_result!['strategy'], style: TextStyle(fontWeight: FontWeight.black, fontSize: 18, color: Colors.green.shade800)),
                        Container(
                          padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: Colors.green.shade600, borderRadius: BorderRadius.circular(8)),
                          child: Text(_result!['savings_percentage'], style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        )
                      ],
                    ),
                    SizedBox(height: 8),
                    Text(_result!['ai_note'], style: TextStyle(color: Colors.green.shade700, fontSize: 12, fontWeight: FontWeight.w600)),
                    Divider(height: 32),
                    ...(_result!['items'] as List).map((i) => Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(i['name'], style: TextStyle(fontWeight: FontWeight.bold)),
                              Text(i['store'], style: TextStyle(color: Colors.grey, fontSize: 10)),
                            ],
                          ),
                          Text(i['price'], style: TextStyle(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    )).toList(),
                    Divider(height: 32),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('TOPLAM TASARRUF', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey)),
                        Text(_result!['savings'], style: TextStyle(fontWeight: FontWeight.black, fontSize: 20, color: Colors.green.shade900)),
                      ],
                    )
                  ],
                ),
              )
            ]
          ],
        ),
      ),
    );
  }
}
