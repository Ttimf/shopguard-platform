import 'package:flutter/material.dart';

import '../data/camera_models.dart';

/// Форма создания/редактирования камеры. Возвращает payload (Map) или null.
class CameraFormSheet extends StatefulWidget {
  final CameraModel? camera; // null — создание
  const CameraFormSheet({super.key, this.camera});

  @override
  State<CameraFormSheet> createState() => _CameraFormSheetState();
}

class _CameraFormSheetState extends State<CameraFormSheet> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _rtsp;
  late final TextEditingController _username;
  late final TextEditingController _password;
  late final TextEditingController _description;
  late final TextEditingController _manufacturer;
  late final TextEditingController _model;
  late final TextEditingController _location;
  double _fps = 15;

  bool get _isEdit => widget.camera != null;

  @override
  void initState() {
    super.initState();
    final c = widget.camera;
    _name = TextEditingController(text: c?.name ?? '');
    _rtsp = TextEditingController(text: c?.rtspUrl ?? '');
    _username = TextEditingController(text: c?.username ?? '');
    _password = TextEditingController();
    _description = TextEditingController(text: c?.description ?? '');
    _manufacturer = TextEditingController(text: c?.manufacturer ?? '');
    _model = TextEditingController(text: c?.model ?? '');
    _location = TextEditingController(text: c?.location ?? '');
    _fps = (c?.fpsLimit ?? 15).toDouble();
  }

  @override
  void dispose() {
    for (final ctl in [
      _name, _rtsp, _username, _password,
      _description, _manufacturer, _model, _location,
    ]) {
      ctl.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!_form.currentState!.validate()) return;
    final payload = <String, dynamic>{
      'name': _name.text.trim(),
      'rtspUrl': _rtsp.text.trim(),
      'fpsLimit': _fps.round(),
      'username': _username.text.trim(),
      'description': _description.text.trim(),
      'manufacturer': _manufacturer.text.trim(),
      'model': _model.text.trim(),
      'location': _location.text.trim(),
    };
    // пароль: отправляем только если ввели (на редактировании пусто = не менять)
    if (_password.text.isNotEmpty) payload['password'] = _password.text;
    Navigator.of(context).pop(payload);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Form(
        key: _form,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(_isEdit ? 'Изменить камеру' : 'Новая камера',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              _field(_name, 'Название *',
                  validator: (v) =>
                      (v == null || v.trim().length < 2) ? 'Мин. 2 символа' : null),
              _field(_rtsp, 'RTSP-адрес *',
                  hint: 'rtsp://ip:554/stream',
                  validator: (v) =>
                      (v == null || v.trim().length < 3) ? 'Укажите RTSP' : null),
              Row(children: [
                Expanded(child: _field(_username, 'Логин')),
                const SizedBox(width: 12),
                Expanded(
                  child: _field(_password, 'Пароль',
                      obscure: true,
                      hint: _isEdit ? 'без изменений' : null),
                ),
              ]),
              _field(_location, 'Местоположение'),
              _field(_description, 'Описание'),
              Row(children: [
                Expanded(child: _field(_manufacturer, 'Производитель')),
                const SizedBox(width: 12),
                Expanded(child: _field(_model, 'Модель')),
              ]),
              const SizedBox(height: 8),
              Text('Лимит FPS: ${_fps.round()}'),
              Slider(
                value: _fps,
                min: 1,
                max: 30,
                divisions: 29,
                label: '${_fps.round()}',
                onChanged: (v) => setState(() => _fps = v),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: _submit,
                child: Text(_isEdit ? 'Сохранить' : 'Добавить'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController c,
    String label, {
    String? hint,
    bool obscure = false,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextFormField(
        controller: c,
        obscureText: obscure,
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }
}
