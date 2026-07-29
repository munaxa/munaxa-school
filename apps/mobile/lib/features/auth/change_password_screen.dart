import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/strings.dart';
import 'auth_providers.dart';
import 'auth_controller.dart';

/// First-login password change. Shown when the temporary password must be replaced.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(authApiProvider).changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      ref.read(authControllerProvider.notifier).markPasswordChanged();
    } catch (e) {
      setState(() => _error = ref.read(stringsProvider).t('auth.changePasswordFailed'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('auth.setNewPassword'))),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      s.t('auth.chooseNewPassword'),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      s.t('auth.tempPasswordHint'),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: _current,
                      obscureText: true,
                      decoration: InputDecoration(labelText: s.t('auth.currentPassword')),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? s.t('auth.currentPasswordRequired') : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _next,
                      obscureText: true,
                      decoration: InputDecoration(labelText: s.t('auth.newPassword')),
                      validator: (v) =>
                          (v == null || v.length < 10) ? s.t('auth.passwordRule') : null,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _loading ? null : _submit,
                      child: Text(_loading ? s.t('auth.saving') : s.t('auth.savePassword')),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
