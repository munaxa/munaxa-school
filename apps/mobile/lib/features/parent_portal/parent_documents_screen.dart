import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/strings.dart';
import '../shell/dashboard_widgets.dart';
import 'parent_portal_providers.dart';

const _categories = ['REPORT_CARD', 'MEDICAL', 'ID', 'CERTIFICATE', 'OTHER'];

String _contentTypeFor(String? ext) {
  switch ((ext ?? '').toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}

/// The selected child's document vault: list (open externally) + upload from device.
class ParentDocumentsTab extends ConsumerWidget {
  const ParentDocumentsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsAsync = ref.watch(childDocumentsProvider);
    final childId = ref.watch(selectedChildIdProvider);
    final s = ref.watch(stringsProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(childDocumentsProvider),
        child: docsAsync.when(
          loading: () => const AsyncSection(loading: true, error: null, child: SizedBox()),
          error: (e, _) => AsyncSection(
            loading: false,
            error: e,
            onRetry: () => ref.invalidate(childDocumentsProvider),
            child: const SizedBox(),
          ),
          data: (docs) {
            if (docs.isEmpty) {
              return ListView(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(s.t('empty.noDocuments')),
                  ),
                ],
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: docs.length,
              itemBuilder: (context, i) {
                final d = docs[i];
                final url = d.downloadUrl;
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.description),
                    title: Text(d.title),
                    subtitle: Text('${d.category} · ${d.fileName}'),
                    trailing: url.isEmpty ? null : const Icon(Icons.open_in_new, size: 18),
                    onTap: url.isEmpty
                        ? null
                        : () async {
                            final messenger = ScaffoldMessenger.of(context);
                            final ok = await launchUrl(
                              Uri.parse(url),
                              mode: LaunchMode.externalApplication,
                            );
                            if (!ok) {
                              messenger.showSnackBar(
                                SnackBar(content: Text(s.t('documents.openFailed'))),
                              );
                            }
                          },
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: childId == null ? null : () => _pickAndUpload(context, ref, childId),
        icon: const Icon(Icons.upload_file),
        label: Text(s.t('documents.upload')),
      ),
    );
  }

  Future<void> _pickAndUpload(BuildContext context, WidgetRef ref, String childId) async {
    final result = await FilePicker.platform.pickFiles(withData: true);
    final file = result?.files.single;
    final bytes = file?.bytes;
    if (file == null || bytes == null) return;
    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _UploadSheet(
        studentId: childId,
        fileName: file.name,
        contentType: _contentTypeFor(file.extension),
        bytes: bytes,
      ),
    );
  }
}

class _UploadSheet extends ConsumerStatefulWidget {
  const _UploadSheet({
    required this.studentId,
    required this.fileName,
    required this.contentType,
    required this.bytes,
  });

  final String studentId;
  final String fileName;
  final String contentType;
  final Uint8List bytes;

  @override
  ConsumerState<_UploadSheet> createState() => _UploadSheetState();
}

class _UploadSheetState extends ConsumerState<_UploadSheet> {
  late final TextEditingController _title =
      TextEditingController(text: _stripExtension(widget.fileName));
  String _category = _categories.first;
  bool _saving = false;
  String? _error;

  static String _stripExtension(String name) {
    final dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(0, dot) : name;
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final strings = ref.read(stringsProvider);
    if (_title.text.trim().isEmpty) {
      setState(() => _error = strings.t('documents.addTitle'));
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(parentPortalApiProvider).uploadDocument(
            studentId: widget.studentId,
            title: _title.text.trim(),
            category: _category,
            fileName: widget.fileName,
            contentType: widget.contentType,
            bytes: widget.bytes,
          );
      ref.invalidate(childDocumentsProvider);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      setState(() => _error = strings.t('documents.uploadFailed'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(s.t('documents.uploadTitle'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(widget.fileName, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 16),
          TextField(
            controller: _title,
            decoration:
                InputDecoration(labelText: s.t('documents.title'), border: const OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _category,
            decoration: InputDecoration(
                labelText: s.t('documents.category'), border: const OutlineInputBorder()),
            items: [
              for (final c in _categories) DropdownMenuItem(value: c, child: Text(c)),
            ],
            onChanged: (v) => setState(() => _category = v ?? _categories.first),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _submit,
            child: Text(_saving ? s.t('documents.uploading') : s.t('documents.upload')),
          ),
        ],
      ),
    );
  }
}
