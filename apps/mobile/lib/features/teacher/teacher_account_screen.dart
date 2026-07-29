import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/strings.dart';
import '../auth/auth_controller.dart';

/// Teacher account tab: identity, roles, and sign-out.
class TeacherAccountTab extends ConsumerWidget {
  const TeacherAccountTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final principal = auth is AuthAuthenticated ? auth.principal : null;
    final s = ref.watch(stringsProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Center(child: CircleAvatar(radius: 36, child: Icon(Icons.person, size: 36))),
        const SizedBox(height: 24),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.badge_outlined),
                title: Text(s.t('account.roles')),
                subtitle: Text(principal?.roles.join(', ') ?? '—'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.apartment_outlined),
                title: Text(s.t('account.school')),
                subtitle: Text(principal?.tenantId ?? '—'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          icon: const Icon(Icons.logout),
          label: Text(s.t('common.signOut')),
        ),
      ],
    );
  }
}
