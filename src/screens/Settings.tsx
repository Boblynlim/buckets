import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useAction, useConvex } from 'convex/react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../../convex/_generated/api';
import type { Bucket } from '../types';
import { getCupForBucketId, registerCupAssignments } from '../constants/bucketIcons';
import { CSVImportPreview } from '../components/CSVImportPreview';
import {
  exportExpensesToCSV,
  generateCSVTemplate,
  downloadCSV,
  parseCSVToExpenses,
  type CSVExpense,
} from '../utils/csvExport';
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribed as checkPushSubscribed,
} from '../utils/pushNotifications';
import { COLORS, cupSrc, currentMonth, money, useHomeStyles } from './home/homeStyles';
import {
  BODY, Check, Field, Group, LABEL, Page, Row, Switch, Toast, useSettingsStyles, type ToastState,
} from './settings/parts';

interface SettingsProps {
  navigation?: any;
  onAddBucket?: () => void;
  onEditBucket?: (bucket: Bucket) => void;
  onSetIncome?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToLetters?: () => void;
  onNavigateToReviewQueue?: () => void;
}

type View = 'main' | 'cups' | 'newGroup' | 'editGroup' | 'notifications' | 'import' | 'export' | 'passcode' | 'reset';

const RESET_WORD = 'reset';

// The cup photo for a bucket: its named pottery if it has one, otherwise the
// cup it was assigned by id (so unnamed cups still look different).
function bucketCup(b: Bucket): string {
  const named = cupSrc(b.name);
  if (named !== cupSrc('\u0000')) return named;
  const mod: any = getCupForBucketId(b._id, b.icon);
  return typeof mod === 'string' ? mod : mod?.default ?? mod?.uri ?? named;
}

function bucketLine(b: Bucket): string {
  const goal = `goal ${money(b.targetAmount || 0)}`;
  if (b.bucketMode === 'save') {
    if (b.contributionType === 'percentage') return `${b.contributionPercent || 0}% of pay · ${goal}`;
    return b.contributionAmount ? `${money(b.contributionAmount)} a month · ${goal}` : goal;
  }
  return b.allocationType === 'percentage'
    ? `${b.plannedPercent || 0}% a month`
    : `${money(b.plannedAmount || 0)} a month`;
}

function CupThumb({ bucket, size = 36 }: { bucket: Bucket; size?: number }) {
  return (
    <span className="st-cups" style={{ width: size, height: size, flexShrink: 0, display: 'flex' }}>
      <img src={bucketCup(bucket)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom' }} />
    </span>
  );
}

export const Settings: React.FC<SettingsProps> = ({
  navigation,
  onAddBucket,
  onEditBucket,
  onSetIncome,
  onNavigateToReviewQueue,
}) => {
  useHomeStyles();
  useSettingsStyles();

  const [view, setView] = useState<View>('main');
  const [toast, setToast] = useState<ToastState>(null);
  const showToast = (message: string, tone: 'ok' | 'error' | 'busy' = 'ok') => setToast({ message, tone });

  // CSV import
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [parsedExpenses, setParsedExpenses] = useState<CSVExpense[]>([]);

  // Groups
  const [groupName, setGroupName] = useState('');
  const [groupSelected, setGroupSelected] = useState<Set<string>>(new Set());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);

  // Change passcode
  const [currentPc, setCurrentPc] = useState('');
  const [newPc, setNewPc] = useState('');
  const [confirmPc, setConfirmPc] = useState('');
  const [pcError, setPcError] = useState('');
  const [pcSubmitting, setPcSubmitting] = useState(false);

  // Reset
  const [resetWord, setResetWord] = useState('');
  const [resetting, setResetting] = useState(false);

  // Push notifications
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const convex = useConvex();

  const { user: currentUser, sessionToken, logout } = useAuth();
  const changePasscodeAction = useAction(api.auth.changePasscode);
  const buckets = useQuery(api.buckets.getByUser, currentUser ? { userId: currentUser._id } : 'skip');
  const expenses = useQuery(api.expenses.getByUser, currentUser ? { userId: currentUser._id } : 'skip');
  const reviewPendingCount = useQuery(
    api.pendingTransactions.pendingCount,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const incomeEntries = useQuery(
    api.monthlyIncome.getByMonth,
    currentUser ? { userId: currentUser._id, month: currentMonth() } : 'skip',
  );
  const groups = useQuery(api.groups.getByUser, currentUser ? { userId: currentUser._id } : 'skip');
  const bulkImport = useMutation(api.expenses.bulkImport);
  const generateReport = useAction(api.reportsNew.generateMonthlyReport);
  const resetAllData = useMutation(api.reset.deleteAllUserData);
  const createGroup = useMutation(api.groups.create);
  const updateGroup = useMutation(api.groups.update);
  const removeGroup = useMutation(api.groups.remove);
  const assignBucketToGroup = useMutation(api.groups.assignBucket);

  useEffect(() => {
    setPushSupported(isPushSupported());
    checkPushSubscribed().then(setPushEnabled);
  }, []);

  const allBuckets: Bucket[] = (buckets as Bucket[] | undefined) || [];
  const allExpenses = expenses || [];
  const allGroups = groups || [];
  registerCupAssignments(allBuckets.map(b => b._id));

  const monthlyIncome = (incomeEntries || []).reduce((sum, income) => sum + income.amount, 0);
  const totalAllocation = allBuckets.reduce(
    (sum, b) => sum + (b.bucketMode === 'save' ? b.contributionAmount || 0 : b.plannedAmount || 0),
    0,
  );

  const handleTogglePush = async (value: boolean) => {
    if (!currentUser) return;
    setPushLoading(true);
    try {
      if (value) {
        const success = await subscribeToPush(currentUser._id, convex);
        setPushEnabled(success);
        if (!success) showToast('Allow notifications in your browser settings first.', 'error');
      } else {
        await unsubscribeFromPush(convex);
        setPushEnabled(false);
      }
    } catch (error) {
      console.error('Push toggle error:', error);
      showToast('Could not change notifications.', 'error');
    }
    setPushLoading(false);
  };

  const handleExportCSV = () => {
    if (!currentUser || allBuckets.length === 0 || allExpenses.length === 0) {
      showToast('Nothing to export yet.', 'error');
      return;
    }
    try {
      const csv = exportExpensesToCSV(allExpenses, allBuckets);
      const filename = `buckets_expenses_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csv, filename);
      showToast(`Exported ${allExpenses.length} spend${allExpenses.length !== 1 ? "s" : ""}.`);
    } catch (error) {
      console.error('Export error:', error);
      showToast('Export failed. Try again.', 'error');
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadCSV(generateCSVTemplate(allBuckets), 'buckets_import_template.csv');
      showToast('Template downloaded, with your cup names.');
    } catch (error) {
      console.error('Template error:', error);
      showToast('Could not download the template.', 'error');
    }
  };

  const handleImportCSV = (csvText: string) => {
    if (!currentUser || allBuckets.length === 0) {
      showToast('Add a cup first.', 'error');
      return;
    }
    try {
      const parsed = parseCSVToExpenses(csvText, allBuckets);
      if (parsed.length === 0) {
        showToast('No spends found in that file.', 'error');
        return;
      }
      setParsedExpenses(parsed);
      setShowImportPreview(true);
    } catch (error) {
      console.error('Import error:', error);
      showToast((error as Error).message || 'Could not read that file.', 'error');
    }
  };

  const pickCSV = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = event => handleImportCSV(event.target?.result as string);
      reader.onerror = error => {
        console.error('FileReader error:', error);
        showToast('Could not read that file.', 'error');
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleConfirmImport = async (rows: CSVExpense[]) => {
    if (!currentUser) return;
    try {
      showToast('Importing…', 'busy');
      const bucketNameMap = new Map(allBuckets.map(b => [b.name.toLowerCase().trim(), b._id]));
      const expensesToImport = rows.map(exp => {
        const bucketId = bucketNameMap.get(exp.bucket.toLowerCase().trim());
        if (!bucketId) throw new Error(`Unknown cup: ${exp.bucket}`);
        // Parse YYYY-MM-DD as local noon so month boundaries match manual spends.
        const parts = exp.date.split('-');
        const date = parts.length === 3
          ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0).getTime()
          : new Date(exp.date).getTime();
        return {
          bucketId,
          amount: exp.amount,
          date,
          note: exp.note,
          worthIt: exp.worthIt ?? false,
          category: exp.category,
          merchant: exp.merchant,
          needsVsWants: exp.needsVsWants,
        };
      });
      const results = await bulkImport({ userId: currentUser._id, expenses: expensesToImport as any });
      if (results.failed === 0) {
        showToast(`Imported ${results.success} spends.`);
      } else {
        console.error('Import errors:', results.errors);
        showToast(`Imported ${results.success}. ${results.failed} failed.`, 'error');
      }
      setShowImportPreview(false);
      if (results.success > 0) {
        try {
          await generateReport({ userId: currentUser._id });
        } catch (reportError) {
          console.error('Report generation failed:', reportError);
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      showToast((error as Error).message || 'Import failed.', 'error');
    }
  };

  const handleAddBucket = () => {
    if (onAddBucket) onAddBucket();
    else alert('Use the + button at the bottom to add a cup');
  };

  const handleEditBucket = (bucket: Bucket) => {
    if (onEditBucket) onEditBucket(bucket);
    else alert(`Editing ${bucket.name} is not available here yet.`);
  };

  const handleSetIncome = () => {
    if (onSetIncome) onSetIncome();
    else alert('Income can be set from the native app for now.');
  };

  const openReview = () => {
    if (onNavigateToReviewQueue) onNavigateToReviewQueue();
    else navigation?.navigate('ReviewQueue');
  };

  const openPasscode = () => {
    setPcError('');
    setCurrentPc('');
    setNewPc('');
    setConfirmPc('');
    setView('passcode');
  };

  const handleChangePasscode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setPcError('');
    if (!currentPc || !newPc || !confirmPc) return setPcError('Fill in all three.');
    if (!/^\d{6}$/.test(newPc)) return setPcError('Your new passcode needs 6 digits.');
    if (newPc !== confirmPc) return setPcError('The new passcodes don’t match.');
    if (!sessionToken) return;
    setPcSubmitting(true);
    try {
      await changePasscodeAction({ sessionToken, currentPasscode: currentPc, newPasscode: newPc });
      setView('main');
      showToast('Passcode changed.');
    } catch (err: any) {
      const msg = err?.data || err?.message || 'Could not change your passcode.';
      const clean = typeof msg === 'string' && msg.includes('Uncaught Error:')
        ? msg.split('Uncaught Error:').pop()!.split('\n')[0].trim()
        : typeof msg === 'string' ? msg : 'Could not change your passcode.';
      setPcError(clean);
    } finally {
      setPcSubmitting(false);
    }
  };

  const handleResetAllData = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentUser || resetWord.trim().toLowerCase() !== RESET_WORD) return;
    setResetting(true);
    try {
      await resetAllData({ userId: currentUser._id });
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to reset data:', error);
      showToast(error?.message || 'Reset failed. Nothing was deleted.', 'error');
      setResetting(false);
    }
  };

  // Groups
  const openNewGroup = () => {
    setGroupName('');
    setGroupSelected(new Set());
    setView('newGroup');
  };

  const openEditGroup = (groupId: string) => {
    const g = allGroups.find(x => x._id === groupId);
    setEditingGroupId(groupId);
    setGroupName(g?.name ?? '');
    setGroupSelected(new Set(allBuckets.filter(b => b.groupId === groupId).map(b => b._id)));
    setView('editGroup');
  };

  const toggleSelected = (id: string) => {
    const next = new Set(groupSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setGroupSelected(next);
  };

  const saveNewGroup = async () => {
    if (!currentUser || !groupName.trim() || groupSelected.size === 0) return;
    setGroupSaving(true);
    try {
      const groupId = await createGroup({ userId: currentUser._id, name: groupName.trim() });
      for (const bucketId of groupSelected) {
        await assignBucketToGroup({ bucketId: bucketId as any, groupId });
      }
      setView('cups');
    } catch (err) {
      console.error(err);
      showToast('Could not make that group.', 'error');
    } finally {
      setGroupSaving(false);
    }
  };

  const saveEditGroup = async () => {
    const group = allGroups.find(g => g._id === editingGroupId);
    if (!group) return;
    setGroupSaving(true);
    try {
      const trimmed = groupName.trim();
      if (trimmed && trimmed !== group.name) await updateGroup({ groupId: group._id, name: trimmed });
      for (const bucket of allBuckets) {
        const shouldBeIn = groupSelected.has(bucket._id);
        const isIn = bucket.groupId === group._id;
        if (shouldBeIn && !isIn) await assignBucketToGroup({ bucketId: bucket._id as any, groupId: group._id });
        else if (!shouldBeIn && isIn) await assignBucketToGroup({ bucketId: bucket._id as any, groupId: undefined });
      }
      setView('cups');
    } catch (err) {
      console.error(err);
      showToast('Could not save the group.', 'error');
    } finally {
      setGroupSaving(false);
    }
  };

  const deleteGroup = async () => {
    const group = allGroups.find(g => g._id === editingGroupId);
    if (!group) return;
    const count = allBuckets.filter(b => b.groupId === group._id).length;
    const msg = count > 0
      ? `Delete the group “${group.name}”? Its ${count} cup${count > 1 ? 's' : ''} stay, just ungrouped.`
      : `Delete the group “${group.name}”?`;
    if (!confirm(msg)) return;
    await removeGroup({ groupId: group._id });
    setView('cups');
  };

  if (currentUser === undefined || buckets === undefined) {
    return <div className="bk-root" style={{ minHeight: '100vh' }} />;
  }

  const pending = reviewPendingCount ?? 0;

  // Picking cups for a group (new or existing).
  const cupPicker = (ownGroupId: string | null) => (
    <Group label="Cups in this group">
      {allBuckets.map(b => {
        const other = b.groupId && b.groupId !== ownGroupId ? allGroups.find(g => g._id === b.groupId) : null;
        const on = groupSelected.has(b._id);
        return (
          <Row
            key={b._id}
            leading={<><Check on={on} dim={!!other} /><span style={{ opacity: other ? 0.4 : 1, display: 'flex' }}><CupThumb bucket={b} size={30} /></span></>}
            title={b.name}
            tone={other ? 'faint' : 'ink'}
            sub={other ? `In ${other.name}` : undefined}
            onClick={() => toggleSelected(b._id)}
            disabled={!!other}
          />
        );
      })}
    </Group>
  );

  const cupRow = (b: Bucket) => (
    <Row
      key={b._id}
      leading={<CupThumb bucket={b} />}
      title={b.name}
      sub={bucketLine(b)}
      chevron
      onClick={() => {
        setView('main');
        handleEditBucket(b);
      }}
    />
  );

  return (
    <div className="bk-root bk-scroll" style={{ height: '100vh', overflowY: 'auto', scrollbarWidth: 'none' as any }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '64px 20px 140px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 4px' }}>Settings</h1>

        <Group label="Money">
          <Row title="Income" value={monthlyIncome > 0 ? `${money(monthlyIncome)} a month` : 'Not set'} chevron onClick={handleSetIncome} />
          <Row
            title="Cups"
            sub={`${allBuckets.length} cup${allBuckets.length !== 1 ? 's' : ''} · ${money(totalAllocation)} a month`}
            trailing={allBuckets.length > 0 ? (
              <span className="st-cups" style={{ display: 'flex', alignItems: 'flex-end' }}>
                {allBuckets.slice(0, 3).map((b, i) => (
                  <img key={b._id} src={bucketCup(b)} alt="" style={{ width: 28, height: 28, objectFit: 'contain', marginLeft: i === 0 ? 0 : -8 }} />
                ))}
              </span>
            ) : undefined}
            chevron
            onClick={() => setView('cups')}
          />
          <Row
            title="Review queue"
            trailing={pending > 0 ? (
              <span style={{ fontSize: 13, fontWeight: 500, color: '#fff', background: COLORS.green, borderRadius: 999, minWidth: 22, height: 22, padding: '0 7px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pending}
              </span>
            ) : undefined}
            value={pending > 0 ? undefined : 'All clear'}
            chevron
            onClick={openReview}
          />
        </Group>

        <Group label="App">
          <Row title="Notifications" value={pushEnabled ? 'On' : 'Off'} chevron onClick={() => setView('notifications')} />
          <Row title="Import spends" chevron onClick={() => setView('import')} />
          <Row title="Export spends" chevron onClick={() => setView('export')} />
        </Group>

        <Group label="Account">
          {currentUser?.email && <Row title={<span style={{ color: COLORS.muted }}>{currentUser.email}</span>} />}
          <Row title="Change passcode" chevron onClick={openPasscode} />
          <Row title="Log out" tone="rust" onClick={logout} />
        </Group>

        <Group>
          <Row title="Reset all data" tone="rust" chevron onClick={() => { setResetWord(''); setView('reset'); }} />
        </Group>

        <footer style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 8, fontSize: 13, color: '#A89E92' }}>
          <span>Buckets 1.0</span>
          <span>Made with care by Jaz</span>
        </footer>
      </div>

      {view === 'cups' && (
        <Page
          title="Cups"
          onBack={() => setView('main')}
          action={<button type="button" className="st-link" style={{ color: COLORS.ink }} onClick={() => { setView('main'); handleAddBucket(); }}>Add a cup</button>}
        >
          {allBuckets.length === 0 ? (
            <p style={BODY}>No cups yet. Add one to start budgeting.</p>
          ) : (() => {
            const ungrouped = allBuckets.filter(b => !b.groupId || !allGroups.some(g => g._id === b.groupId));
            return (
              <>
                {allGroups.map(g => {
                  const inGroup = allBuckets.filter(b => b.groupId === g._id);
                  return (
                    <Group
                      key={g._id}
                      label={g.name}
                      action={<button type="button" className="st-link" style={{ fontSize: 13, margin: '-12px 0' }} onClick={() => openEditGroup(g._id)}>Edit</button>}
                    >
                      {inGroup.length ? inGroup.map(cupRow) : <Row title="No cups in this group" tone="faint" />}
                    </Group>
                  );
                })}
                {ungrouped.length > 0 && (
                  <Group label={allGroups.length ? 'Not in a group' : undefined}>{ungrouped.map(cupRow)}</Group>
                )}
              </>
            );
          })()}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button type="button" className="st-link" onClick={openNewGroup}>New group</button>
            <span style={{ ...LABEL, color: '#A89E92' }}>To retire a cup, open it.</span>
          </div>
        </Page>
      )}

      {view === 'newGroup' && (
        <Page title="New group" backLabel="Cups" onBack={() => setView('cups')}>
          <Field label="Name" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Essentials, fun, savings…" autoFocus />
          {cupPicker(null)}
          <button type="button" className="bk-btn" disabled={!groupName.trim() || groupSelected.size === 0 || groupSaving} onClick={saveNewGroup}>
            {groupSelected.size > 0 ? `Make group with ${groupSelected.size} cup${groupSelected.size > 1 ? 's' : ''}` : 'Make group'}
          </button>
        </Page>
      )}

      {view === 'editGroup' && editingGroupId && (
        <Page title="Edit group" backLabel="Cups" onBack={() => setView('cups')}>
          <Field label="Name" value={groupName} onChange={e => setGroupName(e.target.value)} />
          {cupPicker(editingGroupId)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className="bk-btn" disabled={!groupName.trim() || groupSaving} onClick={saveEditGroup}>Save</button>
            <button type="button" className="st-link" style={{ color: COLORS.rust }} onClick={deleteGroup}>Delete group</button>
          </div>
        </Page>
      )}

      {view === 'notifications' && (
        <Page title="Notifications" onBack={() => setView('main')}>
          {pushSupported ? (
            <>
              <Group>
                <Row
                  title="Push notifications"
                  sub="Low cups, payday and reminders"
                  trailing={<Switch label="Push notifications" on={pushEnabled} disabled={pushLoading} onChange={handleTogglePush} />}
                />
              </Group>
              {pushEnabled && <p style={{ ...BODY, margin: '0 4px' }}>On. We’ll nudge you when a cup runs low and when it’s payday.</p>}
            </>
          ) : (
            <p style={{ ...BODY, margin: '0 4px' }}>This browser can’t show notifications. Try Chrome or Edge, or add Buckets to your home screen.</p>
          )}
        </Page>
      )}

      {view === 'import' && (
        <Page title="Import spends" onBack={() => setView('main')}>
          <p style={{ ...BODY, margin: '0 4px' }}>Bring in spends from a CSV file. Start from the template so the columns line up.</p>
          <Group>
            <Row title="Choose a CSV file" chevron onClick={pickCSV} />
            <Row title="Download the template" sub="Already has your cup names" chevron onClick={handleDownloadTemplate} />
          </Group>
          <Group label="Columns">
            <Row title="Date" value="2026-01-15" />
            <Row title="Bucket" value="A cup name, exactly" />
            <Row title="Amount" value="42.50, no $" />
            <Row title="Note" value="Quote it if it has commas" />
            <Row title="Category" value="Optional" />
            <Row title="Merchant" value="Optional" />
            <Row title="Needs vs wants" value="Optional" />
          </Group>
        </Page>
      )}

      {view === 'export' && (
        <Page title="Export spends" onBack={() => setView('main')}>
          <p style={{ ...BODY, margin: '0 4px' }}>A spreadsheet of every spend, for backup or your own sums.</p>
          <Group>
            <Row title="Download CSV" value={`${allExpenses.length} spend${allExpenses.length !== 1 ? 's' : ''}`} chevron onClick={handleExportCSV} />
          </Group>
        </Page>
      )}

      {view === 'passcode' && (
        <Page title="Change passcode" onBack={() => setView('main')}>
          <form onSubmit={handleChangePasscode} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {([
              ['Current passcode', currentPc, setCurrentPc, 'current-password'],
              ['New passcode', newPc, setNewPc, 'new-password'],
              ['New passcode again', confirmPc, setConfirmPc, 'new-password'],
            ] as const).map(([label, value, set, ac], i) => (
              <Field
                key={label}
                label={label}
                type="password"
                inputMode="numeric"
                autoComplete={ac}
                maxLength={6}
                placeholder="6 digits"
                autoFocus={i === 0}
                value={value}
                onChange={e => { set(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setPcError(''); }}
                style={{ letterSpacing: value ? '0.3em' : undefined }}
              />
            ))}
            <span role="alert" style={{ fontSize: 14, color: COLORS.rust, minHeight: 20 }}>{pcError}</span>
            <button type="submit" className="bk-btn" disabled={pcSubmitting}>{pcSubmitting ? 'Saving…' : 'Change passcode'}</button>
          </form>
        </Page>
      )}

      {view === 'reset' && (
        <Page title="Reset all data" onBack={() => setView('main')}>
          <p style={{ ...BODY, margin: '0 4px' }}>
            This deletes every cup, spend, income entry and repeating payment on this account. It can’t be undone.
            Export your spends first if you might want them.
          </p>
          <form onSubmit={handleResetAllData} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <Field
              label={`Type “${RESET_WORD}” to confirm`}
              value={resetWord}
              onChange={e => setResetWord(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="submit" className="st-danger" disabled={resetWord.trim().toLowerCase() !== RESET_WORD || resetting}>
                {resetting ? 'Deleting…' : 'Delete everything'}
              </button>
              <button type="button" className="st-link" onClick={() => setView('main')}>Keep my data</button>
            </div>
          </form>
        </Page>
      )}

      <CSVImportPreview
        visible={showImportPreview}
        parsedExpenses={parsedExpenses}
        availableBuckets={allBuckets}
        onClose={() => setShowImportPreview(false)}
        onConfirmImport={handleConfirmImport}
      />

      <Toast toast={toast} onHide={() => setToast(null)} />
    </div>
  );
};
