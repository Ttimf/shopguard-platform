import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/theme/app_theme.dart';
import '../cubit/auth_cubit.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _register = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  void _submit() {
    final cubit = context.read<AuthCubit>();
    final email = _email.text.trim();
    final pass = _password.text;
    if (_register) {
      cubit.register(email, pass, _name.text.trim());
    } else {
      cubit.login(email, pass);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: BlocBuilder<AuthCubit, AuthState>(
                builder: (context, state) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(Icons.shield_outlined,
                          size: 72, color: AppColors.primary),
                      const SizedBox(height: 12),
                      const Text('ShopGuard',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 28, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 4),
                      const Text('Защита магазина от краж',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.textMuted)),
                      const SizedBox(height: 32),
                      if (_register)
                        _field(_name, 'Имя', Icons.person_outline),
                      _field(_email, 'Email', Icons.email_outlined,
                          keyboard: TextInputType.emailAddress),
                      _field(_password, 'Пароль', Icons.lock_outline,
                          obscure: true),
                      if (state.error != null) ...[
                        const SizedBox(height: 8),
                        Text(state.error!,
                            style: const TextStyle(color: AppColors.danger)),
                      ],
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: state.loading ? null : _submit,
                        child: state.loading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : Text(_register ? 'Регистрация' : 'Войти'),
                      ),
                      TextButton(
                        onPressed: () =>
                            setState(() => _register = !_register),
                        child: Text(_register
                            ? 'Уже есть аккаунт? Войти'
                            : 'Нет аккаунта? Регистрация'),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label, IconData icon,
      {bool obscure = false, TextInputType? keyboard}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: c,
        obscureText: obscure,
        keyboardType: keyboard,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon),
          filled: true,
          fillColor: AppColors.surface,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}
