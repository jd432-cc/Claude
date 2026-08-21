#!/usr/bin/env python3
"""
Tag "PEER TEMPLATE v1.4.docx" into "peer-v1.4.docx".

The PEER is the long one: seventeen sections and four appendices over
fifty-six tables. Three shapes cover almost all of it —

  a labelled cell        the label stays, the value lands beside it
  a fixed grid           the form's own rows, filled cell by cell
  a row loop             as many rows as there is content, and no more

and a fourth for the prompts. This form carries its instructions inside
the cells, not only in the italic lines between them, so a prompt is
bracketed with IF showGuidance and the value goes underneath it: DRAFT
keeps the prompt, RELEASE prints the answer alone.

Usage:
    python3 tools/tag_peer.py "PEER TEMPLATE v1.4.docx" \
        _tools/report-builder/templates/peer-v1.4.docx
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from docx_tagging import (QN, add_para, bracket, cell, cell_replace, cells,
                          close_row_loop, loop_rows, para_text,
                          replace_in_para, retag, rows, set_cell, tables,
                          wrap_guidance)


def prompt_value(tc, tag):
    """Keep the cell's prompt for DRAFT, and add the value beneath it."""
    for p in list(tc.findall(QN('p'))):
        if para_text(p).strip():
            bracket(p)
    add_para(tc, tag)


def keep_prompt(tc):
    """A cell that is only a prompt: kept for DRAFT, dropped for RELEASE."""
    for p in list(tc.findall(QN('p'))):
        if para_text(p).strip():
            bracket(p)


def grid(T, ti, rows_, cols, key, first_col=1):
    """Fill a fixed grid: one tag per cell, named row by column."""
    n = 0
    for ri, row in enumerate(rows_, start=1):
        for ci, col in enumerate(cols, start=first_col):
            set_cell(cell(T[ti], ri, ci), f'{{{key}.{row}.{col}}}')
            n += 1
    return n


def row_loop(T, ti, first, last, var, collection, keys, numbered=False):
    """Reduce a block of rows to one repeating row, tagged by column."""
    for_row, body, term_row = loop_rows(T[ti], first, last, var, collection)
    cs = cells(body)
    at = 0
    if numbered:
        set_cell(cs[0], '{$idx+1}')
        at = 1
    for i, k in enumerate(keys):
        set_cell(cs[at + i], f'{{${var}.{k}}}')
    close_row_loop(for_row, term_row, var, collection)


def tag(body):
    log = []
    T = tables(body)

    # -- 1. Header block --------------------------------------------------
    cell_replace(cell(T[0], 0, 0), '[TEAM]', '{team}')
    header = [
        (1, 0, '[insert here]', '{eventRounds}'),
        (1, 1, '[insert here]', '{circuit}'),
        (1, 2, '[dd.mm.yyyy - dd.mm.yyyy]', '{dates}'),
        (2, 0, '[insert here]', '{seriesClass}'),
        (2, 1, '[insert here]', '{carNumber}'),
        (2, 2, '[names / here]', '{drivers}'),
        (3, 0, '[name here]', '{preparedBy}'),
        (3, 1, '[name here]', '{reviewedBy}'),
        (3, 2, '[name here]', '{issued}'),
        (4, 0, '[insert here]', '{distribution}'),
        (4, 1, '[DRAFT or RELEASE / letter]', '{statusRevision}'),
        (4, 2, '[RND-EVT-PEER-CAR]', '{reportRef}'),
    ]
    for ri, ci, needle, repl in header:
        if not cell_replace(cell(T[0], ri, ci), needle, repl):
            log.append(f'MISS header [{ri},{ci}] {needle}')
    log.append(f'table 1  header block, {len(header) + 1} tags')

    # -- Executive summary ------------------------------------------------
    # The blank form carries a stray 'gsdf' in the Qualified cell.
    for ri, key in enumerate(['qualified', 'finished', 'points', 'champChange'], start=1):
        set_cell(cell(T[1], ri, 1), f'{{{key}}}')
    set_cell(cell(T[1], 1, 3), '{ourBestLap}')
    set_cell(cell(T[1], 2, 3), '{classBestLap}')
    set_cell(cell(T[1], 3, 3), '{gapToClassBest} s                    {gapPct} %')
    set_cell(cell(T[1], 4, 3), '{gapTrend}')
    log.append('table 2  result and pace, 9 tags (stray blank-form content replaced)')

    prompt_value(cell(T[2], 0, 0), '{why}')
    log.append('table 3  why in three sentences, 1 tag')

    row_loop(T, 3, 1, 3, 'f', 'findings',
             ['finding', 'evidence', 'conf', 'section'], numbered=True)
    log.append('table 4  findings, row loop over `findings`')

    # -- 1. Scope and data provenance -------------------------------------
    for ri, key in enumerate(['eventCovered', 'writtenFor',
                              'primarySources', 'secondarySources']):
        set_cell(cell(T[5], ri, 1), f'{{{key}}}')
    log.append('table 6  scope, 4 tags')

    row_loop(T, 6, 1, 3, 'cv', 'caveats', ['caveat', 'sessions', 'effect'])
    log.append('table 7  caveats, row loop over `caveats`')

    set_cell(cell(T[7], 0, 1), '{dataConfidence}')
    prompt_value(cell(T[7], 0, 2), '{dataConfidenceBasis}')
    log.append('table 8  data confidence, 2 tags')

    # -- 2. Where the gap sits --------------------------------------------
    GAP = ['aero', 'power', 'driver', 'strategy', 'circumstance']
    for ri, row in enumerate(GAP, start=1):
        set_cell(cell(T[8], ri, 1), f'{{gap.{row}.pct}} %')
        for ci, col in enumerate(['s', 'evidence', 'by'], start=2):
            set_cell(cell(T[8], ri, ci), f'{{gap.{row}.{col}}}')
    set_cell(cell(T[8], 6, 1), '{gap.total.pct} %')
    set_cell(cell(T[8], 6, 2), '{gap.total.s}')
    log.append(f'table 9  gap attribution, {len(GAP)} rows plus a derived total')

    prompt_value(cell(T[9], 0, 0), '{gapMethod}')
    log.append('table 10 method for the split, 1 tag')

    # -- 3. Conditions and track evolution --------------------------------
    row_loop(T, 10, 1, 5, 'cn', 'conditions',
             ['session', 'time', 'air', 'track', 'wind', 'notes'])
    log.append('table 11 conditions, row loop over `conditions`')

    set_cell(cell(T[11], 0, 1), '{evo.total} s')
    prompt_value(cell(T[11], 0, 2), '{evo.between}')
    set_cell(cell(T[11], 1, 1), '{evo.rubber} s')
    keep_prompt(cell(T[11], 1, 2))
    set_cell(cell(T[11], 2, 1), '{evo.setup} s')
    set_cell(cell(T[11], 2, 2),
             'Field median gained: {evo.fieldMedian}     We gained: {evo.weGained}')
    log.append('table 12 track evolution, 6 tags')

    prompt_value(cell(T[12], 0, 0), '{conditionsNote}')
    log.append('table 13 conditions note, 1 tag')

    # -- 4. Session by session review -------------------------------------
    set_cell(cell(T[13], 0, 1), '{sess.laps}')
    set_cell(cell(T[13], 0, 3), '{sess.againstPlan}')
    prompt_value(cell(T[13], 0, 4), '{sess.shortfall}')
    set_cell(cell(T[13], 1, 1), '{sess.purpose}')
    set_cell(cell(T[13], 2, 1), '{sess.produced}')
    log.append('table 14 session review, 5 tags')

    row_loop(T, 14, 1, 4, 'rn', 'runs',
             ['run', 'driver', 'tyre', 'laps', 'config', 'result'])
    log.append('table 15 run plan, row loop over `runs`')

    row_loop(T, 15, 1, 2, 'st', 'stints',
             ['driver', 'opening', 'closing', 'deg', 'knee', 'rate'])
    log.append('table 16 stint data, row loop over `stints`')

    # The Combined row is a summary, not another driver: tag it before the
    # loop reduces the rows above it.
    combined = [tr for tr in rows(T[16]) if para_text(cells(tr)[0]) == 'Combined'][0]
    for ci, key in enumerate(['time', 'position', 'gap', 'theoretical', 'unrealised'],
                             start=1):
        set_cell(cells(combined)[ci], f'{{qual.combined.{key}}}')
    row_loop(T, 16, 1, 2, 'q', 'qualifying',
             ['driver', 'time', 'position', 'gap', 'theoretical', 'unrealised'])
    log.append('table 17 qualifying, row loop over `qualifying` plus a combined row')

    race = [
        (1, ['startFinish', 'lapsStops', 'penalties', 'refSequence']),
        (3, ['stationary', 'rank', 'driverChange', 'release']),
        (5, ['inLap', 'outLap', 'traffic', 'trackLimits']),
    ]
    for ri, keys in race:
        for ci, key in enumerate(keys):
            set_cell(cell(T[17], ri, ci), f'{{race.{key}}}')
    log.append('table 18 race, 12 tags')

    prompt_value(cell(T[18], 0, 1), '{attributionNote}')
    log.append('table 19 attribution note, 1 tag')

    # -- 5. Primary technical finding -------------------------------------
    row_loop(T, 19, 1, 4, 'ob', 'observations',
             ['session', 'condition', 'measureA', 'measureB', 'delta'])
    log.append('table 20 observation, row loop over `observations`')

    prompt_value(cell(T[20], 0, 1), '{findingCircuit}')
    set_cell(cell(T[20], 1, 1), '{findingUs}')
    log.append('table 21 circuit against us, 2 tags')

    row_loop(T, 21, 1, 3, 'cc', 'candidates',
             ['cause', 'evidence', 'conf', 'eliminate', 'cost'], numbered=True)
    log.append('table 22 candidate causes, row loop over `candidates`')

    prompt_value(cell(T[22], 0, 0), '{testPlan}')
    log.append('table 23 test plan, 1 tag')

    # -- 6. Fuel and consumption ------------------------------------------
    n = grid(T, 23, ['consumption', 'reserve', 'correction'],
             ['modelled', 'actual1', 'actual2', 'variance'], 'fuel')
    log.append(f'table 24 fuel model, {n} tags')

    prompt_value(cell(T[24], 0, 1), '{fuelDelta}')
    set_cell(cell(T[24], 1, 1),
             '{fuelCarried.litres} l over target  =  {fuelCarried.perLap} s per lap  '
             '=  {fuelCarried.stint} s over the stint')
    prompt_value(cell(T[24], 2, 1), '{fuelRecommendation}')
    log.append('table 25 carried fuel, 5 tags')

    # -- 7. Brakes, cooling and mechanical health -------------------------
    n = grid(T, 25, ['brakeTemp', 'padWear', 'waterTemp', 'oilTemp', 'bottoming'],
             ['value', 'threshold', 'margin'], 'brakes')
    log.append(f'table 26 mechanical health, {n} tags')

    checks = 0
    for ti, ci in ((26, 0), (42, 0)):
        for p in cell(T[ti], 1, ci).findall(QN('p')):
            if '☐' in para_text(p):
                checks += 1
                replace_in_para(p, '☐', f'{{check.c{checks}}}')
    prompt_value(cell(T[26], 1, 1), '{notConstraint}')
    log.append(f'tables 27/43  systems checks, {checks} checkbox tags')

    # -- 8. Setup and aerodynamic notes -----------------------------------
    set_cell(cell(T[27], 0, 1), '{setup.gain} s')
    prompt_value(cell(T[27], 0, 2), '{setup.expectation}')
    set_cell(cell(T[27], 1, 1), '{setup.changeCount}')
    keep_prompt(cell(T[27], 1, 2))
    log.append('table 28 setup gain, 3 tags')

    row_loop(T, 28, 1, 4, 'sc', 'setupChanges',
             ['change', 'session', 'reason', 'effect1', 'effect2', 'retained'])
    log.append('table 29 setup changes, row loop over `setupChanges`')

    for ri, keys in ((1, ['config', 'topSpeed', 'alternative', 'gain']),
                     (3, ['overtakes', 'offsettingLoss', 'recoverable', 'onceFixed'])):
        for ci, key in enumerate(keys):
            set_cell(cell(T[29], ri, ci), f'{{aero.{key}}}')
    log.append('table 30 aerodynamic configuration, 8 tags')

    set_cell(cell(T[30], 0, 1), '{setupPriority}')
    prompt_value(cell(T[30], 1, 0), '{setupAgreed}')
    log.append('table 31 setup priority, 2 tags')

    # -- 9. Driver performance --------------------------------------------
    for ri, key in enumerate(['pace', 'largestGain', 'evidence', 'worth',
                              'recommendation']):
        set_cell(cell(T[31], ri, 1), f'{{d1.{key}}}')
    set_cell(cell(T[31], 1, 2), '{d1.consistency}')
    prompt_value(cell(T[31], 5, 1), '{d1.trialled}')
    set_cell(cell(T[31], 5, 2), '{d1.owner}')
    log.append('table 32 driver 1, 8 tags')

    set_cell(cell(T[32], 0, 1), '{d2.gap} s')
    keep_prompt(cell(T[32], 0, 2))
    log.append('table 33 like for like gap, 1 tag')

    other = [tr for tr in rows(T[33])
             if para_text(cells(tr)[0]).startswith('All other')][0]
    set_cell(cells(other)[1], '{d2.otherLoss}')
    row_loop(T, 33, 1, 4, 'dl', 'driverLosses',
             ['location', 'loss', 'character', 'phase'])
    log.append('table 34 driver losses, row loop over `driverLosses`')

    set_cell(cell(T[34], 0, 1),
             '{d2.concentrationPct} % of the deficit sits in '
             '{d2.concentrationCount} locations')
    set_cell(cell(T[34], 1, 1), '{d2.rootCause}')
    prompt_value(cell(T[34], 2, 1), '{d2.secondOrder}')
    prompt_value(cell(T[34], 3, 1), '{d2.recommendation}')
    set_cell(cell(T[34], 4, 1),
             'PSDR section 3 priorities: {d2.psdrRef}     PSDB: {d2.psdbRef}')
    log.append('table 35 concentration and cross reference, 7 tags')

    row_loop(T, 35, 1, 3, 'co', 'correlation',
             ['corner', 'reported', 'trace', 'verdict'])
    log.append('table 36 correlation, row loop over `correlation`')

    # -- 10. Strategy review and counterfactual ---------------------------
    n = grid(T, 36, ['stopLap', 'stationary', 'inLap', 'outLap', 'undercut'],
             ['planned', 'actual', 'delta', 'comment'], 'strategy')
    log.append(f'table 37 strategy elements, {n} tags')

    set_cell(cell(T[37], 0, 1),
             '{selfInflicted} s against a finishing gap of {finishingGap} s '
             'to P{toPosition}')
    prompt_value(cell(T[37], 1, 0), '{penalties}')
    set_cell(cell(T[37], 2, 1),
             'Predicted: {modelPredicted}     Actual: {modelActual}     '
             'Calibration: {modelCalibration}')
    log.append('table 38 self inflicted loss, 7 tags')

    approach = rows(T[38])[2]
    set_cell(cells(approach)[3], '{approached}')
    keep_prompt(cells(approach)[0])
    row_loop(T, 38, 1, 1, 'cf', 'counterfactuals',
             ['assessed', 'cost', 'gain', 'threshold'])
    log.append('table 39 counterfactuals, row loop over `counterfactuals`')

    # -- 11. Competitor benchmarking --------------------------------------
    row_loop(T, 39, 1, 2, 'cp', 'competitors',
             ['name', 'singleLap', 'degradation', 'pit', 'weakness', 'beat'])
    log.append('table 40 competitors, row loop over `competitors`')

    prompt_value(cell(T[40], 0, 1), '{perCategory}')
    prompt_value(cell(T[40], 1, 1), '{bopPosition}')
    log.append('table 41 category and BoP, 2 tags')

    # -- 12. Reliability and data quality ---------------------------------
    set_cell(cell(T[41], 0, 1), '{reliability.mechanical}')
    prompt_value(cell(T[41], 0, 2), '{reliability.mechanicalDetail}')
    set_cell(cell(T[41], 1, 1), '{reliability.data}')
    prompt_value(cell(T[41], 1, 2), '{reliability.dataDetail}')
    log.append('table 42 failures, 4 tags')

    prompt_value(cell(T[42], 1, 1), '{processFailures}')
    log.append('table 43 process failures, 1 tag')

    row_loop(T, 43, 1, 3, 'ft', 'faults',
             ['fault', 'action', 'parts', 'recurring'])
    log.append('table 44 faults, row loop over `faults`')

    prompt_value(cell(T[44], 0, 0), '{nearMisses}')
    log.append('table 45 near misses, 1 tag')

    # -- 13. Cost of the weekend ------------------------------------------
    COST = ['consumables', 'damage', 'freight', 'personnel', 'unplanned']
    n = grid(T, 45, COST, ['planned', 'actual', 'variance', 'comment'], 'cost')
    for ci, col in enumerate(['planned', 'actual', 'variance'], start=1):
        set_cell(cell(T[45], 6, ci), f'{{cost.total.{col}}}')
    log.append(f'table 46 cost, {n} tags plus a derived total')

    # -- 14/15. Decisions and actions -------------------------------------
    for_row, decision, term_row = loop_rows(T[46], 1, 3, 'dc', 'decisions')
    cs = cells(decision)
    set_cell(cs[0], '{$idx+1}')
    set_cell(cs[1], '{$dc.decision}')
    options = cs[2].findall(QN('p'))
    for p, key in zip(options, ['optionA', 'optionB']):
        replace_in_para(p, ':', f': {{$dc.{key}}}')
    for ci, key in enumerate(['recommendation', 'costRisk', 'owner'], start=3):
        set_cell(cs[ci], f'{{$dc.{key}}}')
    close_row_loop(for_row, term_row, 'dc', 'decisions')
    log.append('table 47 decisions, row loop over `decisions`')

    carried = rows(T[47])[-1]
    prompt_value(cells(carried)[1], '{carriedOver}')
    for_row, action, term_row = loop_rows(T[47], 1, 9, 'ac', 'actions')
    cs = cells(action)
    set_cell(cs[0], '{$idx+1}')
    for ci, key in enumerate(['action', 'owner', 'due'], start=1):
        set_cell(cs[ci], f'{{$ac.{key}}}')
    set_cell(cs[4], 'Section {$ac.links}')
    close_row_loop(for_row, term_row, 'ac', 'actions')
    log.append('table 48 actions, row loop over `actions`')

    # -- 16/17. Forecast and sign off -------------------------------------
    set_cell(cell(T[48], 0, 1), '{fc.nextEvent}')
    forecast = [
        (1, 1, 'circuit'), (1, 3, 'suits'),
        (2, 1, 'dates'), (2, 3, 'because'),
        (3, 1, 'target'), (3, 3, 'targetIfApproved'),
        (4, 1, 'championship'), (4, 3, 'lever'),
    ]
    for ri, ci, key in forecast:
        set_cell(cell(T[48], ri, ci), f'{{fc.{key}}}')
    log.append(f'table 49 forecast, {len(forecast) + 1} tags')

    signoff = [
        (1, 1, '[name here]', '{preparedBy}'),
        (1, 3, '[RND-EVT-PEER-CAR]', '{reportRef}'),
        (2, 1, '[name here]', '{reviewedBy}'),
        (2, 3, '[location here]', '{dataArchivedTo}'),
        (3, 1, '[name here]', '{issued}'),
        (3, 3, '[dd.mm.yyyy / hh:mm]', '{issuedAt}'),
        (4, 1, '[insert here]', '{distribution}'),
    ]
    for ri, ci, needle, repl in signoff:
        if not cell_replace(cell(T[49], ri, ci), needle, repl):
            log.append(f'MISS signoff [{ri},{ci}] {needle}')
    log.append(f'table 50 sign off, {len(signoff)} tags')

    # -- A/B/C/D. Appendices ----------------------------------------------
    for ri, key in enumerate(['fuelCorrection', 'repLaps', 'degradation',
                              'likeForLike', 'deviation']):
        prompt_value(cell(T[50], ri, 1), f'{{method.{key}}}')
    log.append('table 51 methodology notes, 5 tags')

    for ri, key in enumerate(['section', 'represent', 'derived', 'held']):
        prompt_value(cell(T[51], ri, 1), f'{{thresholds.{key}}}')
    log.append('table 52 thresholds, 4 tags')

    row_loop(T, 52, 1, 5, 'dq', 'dataQuality', ['session', 'flags'])
    log.append('table 53 data quality flags, row loop over `dataQuality`')

    row_loop(T, 53, 1, 3, 'cal', 'calibration',
             ['change', 'session', 'reason', 'logged', 'offsets'])
    log.append('table 54 calibration record, row loop over `calibration`')

    # -- Defect in the blank form -----------------------------------------
    # An unresolved cross-reference placeholder sits in the section 3
    # guidance: "Cross check it against section {{ref:driver-performance}}".
    # Left alone it reaches the engine as a command and fails the export,
    # because braces are what a command is made of.
    stray = 0
    for para in body.iter(QN('p')):
        while '{{ref:driver-performance}}' in para_text(para):
            replace_in_para(para, '{{ref:driver-performance}}', '9')
            stray += 1
    log.append(f'defect    {stray} unresolved cross-reference(s) resolved to '
               f'their section number')

    # -- Headings ---------------------------------------------------------
    # The form names four of its own sections with a bracketed placeholder.
    headings = [
        ('[Session]', '{sess.name}'),
        ('[name it]', '{findingName}'),
        ('[Driver 1, category]', '{d1.name}'),
        ('[Driver 2, category]', '{d2.name}'),
        ('Round [   ]', 'Round {actionsRound}'),
    ]
    found = 0
    for para in body.iter(QN('p')):
        for needle, repl in headings:
            if needle in para_text(para) and replace_in_para(para, needle, repl):
                found += 1
    log.append(f'headings  {found} of {len(headings)} section placeholders filled')

    # -- Guidance ---------------------------------------------------------
    g, norm = wrap_guidance(body)
    log.append(f'guidance  {g} body paragraphs wrapped in IF showGuidance '
               f'({norm} italicised to match the form\'s own convention)')

    return log


if __name__ == '__main__':
    retag(sys.argv[1], Path(sys.argv[2]), tag)
